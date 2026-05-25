#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <objc/runtime.h>
#import <AppAmbitSdkPushNotifications-Swift.h>

// ─── cold-start deduplication ─────────────────────────────────────────────────
//
// On a cold-start notification tap (app was killed), BOTH paths fire:
//   1. appDidFinishLaunching: → launchOptions contains the payload (100% reliable)
//   2. userNotificationCenter:didReceiveNotificationResponse: fires afterward
//
// We capture via (1) and use this flag to suppress the duplicate in (2).
// For background→foreground taps, (1) does not fire, so the flag stays NO
// and (2) is the only capture path.

static BOOL _capturedFromLaunchOptions = NO;

// ─── background remote notification swizzle ──────────────────────────────────

typedef void (^RemoteNotificationCompletionHandler)(UIBackgroundFetchResult);
typedef void (*RemoteNotificationIMPType)(id, SEL, UIApplication *, NSDictionary *, RemoteNotificationCompletionHandler);

static RemoteNotificationIMPType _originalRemoteNotificationIMP = NULL;

// ─── JS background handler completion ────────────────────────────────────────
//
// When no original AppDelegate implementation exists, we own the completion
// handler. We hold it here until JS calls backgroundHandlerCompleted(), which
// routes to AppAmbitNotifyJSBackgroundHandlerCompleted(). A 25-second safety
// timeout fires if JS never resolves, and the OS expiration handler fires if
// iOS needs the time back sooner.

static void (^_pendingBGCompletionBlock)(void) = nil;
static UIBackgroundTaskIdentifier _pendingBGTask = 0; // UIBackgroundTaskInvalid == 0; can't use extern const as static initializer
static dispatch_block_t _pendingBGSafetyTimer = nil;

static void AppAmbitFinishBackgroundTask(void) {
    if (_pendingBGCompletionBlock) {
        void (^block)(void) = _pendingBGCompletionBlock;
        _pendingBGCompletionBlock = nil;
        block();
    }
    if (_pendingBGSafetyTimer) {
        dispatch_block_cancel(_pendingBGSafetyTimer);
        _pendingBGSafetyTimer = nil;
    }
    if (_pendingBGTask != UIBackgroundTaskInvalid) {
        [[UIApplication sharedApplication] endBackgroundTask:_pendingBGTask];
        _pendingBGTask = UIBackgroundTaskInvalid;
    }
}

// Called from AppambitPushNotifications.mm via the extern declaration.
void AppAmbitNotifyJSBackgroundHandlerCompleted(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        AppAmbitFinishBackgroundTask();
    });
}

static void AppAmbitRemoteNotificationIMP(
    id self,
    SEL _cmd,
    UIApplication *application,
    NSDictionary *userInfo,
    RemoteNotificationCompletionHandler completionHandler
) {
    [AppAmbitPushWrapper didReceiveBackgroundNotification:userInfo];

    if (_originalRemoteNotificationIMP != NULL) {
        // AppDelegate already handles background time; call through.
        _originalRemoteNotificationIMP(self, _cmd, application, userInfo, completionHandler);
        return;
    }

    // No original implementation — we own the completion handler.
    // Flush any previous task that JS never completed (shouldn't happen normally).
    AppAmbitFinishBackgroundTask();

    _pendingBGCompletionBlock = ^{
        completionHandler(UIBackgroundFetchResultNewData);
    };

    // iOS expiration handler: system needs time back immediately.
    _pendingBGTask = [application beginBackgroundTaskWithExpirationHandler:^{
        AppAmbitFinishBackgroundTask();
    }];

    // Safety timeout: if JS doesn't call backgroundHandlerCompleted within 25s,
    // complete anyway so future background wake-ups are not penalised by iOS.
    dispatch_block_t timer = dispatch_block_create(DISPATCH_BLOCK_INHERIT_QOS_CLASS, ^{
        AppAmbitFinishBackgroundTask();
    });
    _pendingBGSafetyTimer = timer;
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, (int64_t)(25.0 * NSEC_PER_SEC)),
        dispatch_get_main_queue(),
        timer
    );
}

// ─── UNUserNotificationCenter delegate proxy ─────────────────────────────────

@interface AppAmbitNotificationProxy : NSObject <UNUserNotificationCenterDelegate>
@property (nonatomic, weak) id<UNUserNotificationCenterDelegate> next;
+ (instancetype)shared;
@end

@implementation AppAmbitNotificationProxy

+ (instancetype)shared {
    static AppAmbitNotificationProxy *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{ instance = [[AppAmbitNotificationProxy alloc] init]; });
    return instance;
}

// Show notification banner/sound/badge when app is foreground
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
    SEL sel = @selector(userNotificationCenter:willPresentNotification:withCompletionHandler:);
    if ([self.next respondsToSelector:sel]) {
        [self.next userNotificationCenter:center
                  willPresentNotification:notification
                    withCompletionHandler:completionHandler];
    } else {
        if (@available(iOS 14.0, *)) {
            completionHandler(UNNotificationPresentationOptionBanner |
                              UNNotificationPresentationOptionBadge |
                              UNNotificationPresentationOptionSound);
        } else {
            completionHandler(UNNotificationPresentationOptionAlert |
                              UNNotificationPresentationOptionBadge |
                              UNNotificationPresentationOptionSound);
        }
    }
}

// Notification tap — background→foreground taps are captured here.
// Cold-start taps are captured via launchOptions in appDidFinishLaunching: instead;
// this path deduplicates them using _capturedFromLaunchOptions.
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {

    if (_capturedFromLaunchOptions) {
        // Cold-start: already captured via launchOptions — skip to avoid duplicate.
        _capturedFromLaunchOptions = NO;
    } else {
        // Background→foreground tap: not captured yet, capture now.
        NSDictionary *userInfo = response.notification.request.content.userInfo;
        [AppAmbitPushWrapper didReceiveOpenedNotification:userInfo];
    }

    SEL sel = @selector(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:);
    if ([self.next respondsToSelector:sel]) {
        [self.next userNotificationCenter:center
           didReceiveNotificationResponse:response
                    withCompletionHandler:completionHandler];
    } else {
        completionHandler();
    }
}

@end

// ─── setDelegate: swizzle — pins proxy as permanent delegate ──────────────────
//
// React Native (RCTPushNotificationManager) and the AppAmbit native SDK both
// call [UNUserNotificationCenter.current setDelegate:] during app startup.
// Without this swizzle those calls would evict our proxy.
//
// With this swizzle, ANY setDelegate: call from ANY caller is intercepted:
//   • the caller's delegate becomes proxy.next (chaining preserved)
//   • proxy is (re-)installed as the actual delegate
// The proxy forwards both delegate callbacks to proxy.next, so RN and the
// native SDK still receive all the notifications they expect.

typedef void (*SetDelegateIMPType)(id, SEL, id<UNUserNotificationCenterDelegate>);
static SetDelegateIMPType _originalSetDelegateIMP = NULL;

static void AppAmbitSetDelegateIMP(
    UNUserNotificationCenter *center,
    SEL _cmd,
    id<UNUserNotificationCenterDelegate> newDelegate
) {
    AppAmbitNotificationProxy *proxy = [AppAmbitNotificationProxy shared];
    if (newDelegate == proxy) {
        _originalSetDelegateIMP(center, _cmd, newDelegate);
        return;
    }
    proxy.next = newDelegate;
    _originalSetDelegateIMP(center, _cmd, proxy);
}

// ─── main swizzler ────────────────────────────────────────────────────────────

@interface AppAmbitNotificationSwizzler : NSObject
@end

@implementation AppAmbitNotificationSwizzler

+ (void)load {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        // Swizzle UNUserNotificationCenter.setDelegate: so proxy stays pinned
        // regardless of when RN or the native SDK set their own delegates.
        Class uncClass = [UNUserNotificationCenter class];
        SEL setDelegateSel = @selector(setDelegate:);
        Method setDelegateMethod = class_getInstanceMethod(uncClass, setDelegateSel);
        if (setDelegateMethod) {
            _originalSetDelegateIMP = (SetDelegateIMPType)method_getImplementation(setDelegateMethod);
            method_setImplementation(setDelegateMethod, (IMP)AppAmbitSetDelegateIMP);
        }

        [[NSNotificationCenter defaultCenter]
            addObserver:self
               selector:@selector(appWillFinishLaunching:)
                   name:@"UIApplicationWillFinishLaunchingNotification"
                 object:nil];

        [[NSNotificationCenter defaultCenter]
            addObserver:self
               selector:@selector(appDidFinishLaunching:)
                   name:UIApplicationDidFinishLaunchingNotification
                 object:nil];
    });
}

+ (void)appWillFinishLaunching:(NSNotification *)notification {
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:@"UIApplicationWillFinishLaunchingNotification"
                                                  object:nil];

    // Start native SDK — if it calls setDelegate:, the swizzle intercepts and
    // chains its delegate as proxy.next automatically.
    [AppAmbitPushWrapper start];

    // Ensure proxy is the actual delegate. If the SDK called setDelegate:
    // the swizzle already installed proxy; this guard is a no-op in that case.
    AppAmbitNotificationProxy *proxy = [AppAmbitNotificationProxy shared];
    if (UNUserNotificationCenter.currentNotificationCenter.delegate != proxy) {
        UNUserNotificationCenter.currentNotificationCenter.delegate = proxy;
    }

    // ── Cold-start notification tap capture ───────────────────────────────────
    // UIApplicationWillFinishLaunchingNotification carries the same dictionary
    // that was passed as launchOptions to application:willFinishLaunchingWithOptions:.
    // We capture it here early, BEFORE the React Native bridge and its modules
    // are initialized, so the module's init can successfully retrieve it.
    NSDictionary *launchOptions = notification.userInfo;
    NSDictionary *remoteNotification = launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey];
    if (remoteNotification) {
        _capturedFromLaunchOptions = YES;
        [AppAmbitPushWrapper didReceiveOpenedNotification:remoteNotification];
    }
}

+ (void)appDidFinishLaunching:(NSNotification *)notification {
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:UIApplicationDidFinishLaunchingNotification
                                                  object:nil];

    // ── Cold-start notification tap capture (fallback) ───────────────────────
    if (!_capturedFromLaunchOptions) {
        NSDictionary *launchOptions = notification.userInfo;
        NSDictionary *remoteNotification = launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey];
        if (remoteNotification) {
            _capturedFromLaunchOptions = YES;
            [AppAmbitPushWrapper didReceiveOpenedNotification:remoteNotification];
        }
    }

    // ── Background remote notification swizzle ────────────────────────────────
    id<UIApplicationDelegate> delegate = UIApplication.sharedApplication.delegate;
    if (!delegate) return;

    Class delegateClass = object_getClass(delegate);
    SEL selector = @selector(application:didReceiveRemoteNotification:fetchCompletionHandler:);

    Method existingMethod = class_getInstanceMethod(delegateClass, selector);
    if (existingMethod) {
        _originalRemoteNotificationIMP = (RemoteNotificationIMPType)method_getImplementation(existingMethod);
        method_setImplementation(existingMethod, (IMP)AppAmbitRemoteNotificationIMP);
    } else {
        class_addMethod(delegateClass, selector, (IMP)AppAmbitRemoteNotificationIMP, "v@:@@@?");
    }
}

@end
