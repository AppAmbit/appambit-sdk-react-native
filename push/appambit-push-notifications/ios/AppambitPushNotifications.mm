#import "AppambitPushNotifications.h"
#import <AppAmbitSdkPushNotifications-Swift.h>
#import <Network/Network.h>

// Defined in AppAmbitNotificationSwizzler.m — call when JS background handler resolves
extern "C" void AppAmbitNotifyJSBackgroundHandlerCompleted(void);

static NSString * const kPushPrefsKey     = @"appambit_push_has_pending";
static NSString * const kPushEnabledKey   = @"appambit_push_pending_enabled";

@implementation AppambitPushNotifications {
  BOOL _hasListeners;
  BOOL _sdkListenerInstalled;
  NSMutableArray<NSDictionary *> *_pendingBackgroundEvents;
  NSMutableArray<NSDictionary *> *_pendingOpenedEvents;
  NSMutableArray<NSDictionary *> *_pendingForegroundEvents;
  nw_path_monitor_t _pathMonitor;
}

RCT_EXPORT_MODULE(AppambitPushNotifications)

- (instancetype)init {
  self = [super init];
  if (self) {
    _pendingBackgroundEvents = [NSMutableArray new];
    _pendingOpenedEvents     = [NSMutableArray new];
    _pendingForegroundEvents = [NSMutableArray new];
    NSArray<NSDictionary *> *earlyBackground = [AppAmbitPushWrapper getAndClearPendingBackgroundPayloads];
    if (earlyBackground.count > 0) {
      [_pendingBackgroundEvents addObjectsFromArray:earlyBackground];
    }

    NSArray<NSDictionary *> *earlyOpened = [AppAmbitPushWrapper getAndClearPendingOpenedPayloads];
    if (earlyOpened.count > 0) {
      [_pendingOpenedEvents addObjectsFromArray:earlyOpened];
    }

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleBackgroundNotification:)
                                                 name:@"AppAmbit_onBackgroundNotification"
                                               object:nil];

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleOpenedNotification:)
                                                 name:@"AppAmbit_onOpenedNotification"
                                               object:nil];

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleAppBecameActive:)
                                                 name:UIApplicationDidBecomeActiveNotification
                                               object:nil];
  }
  return self;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitPushNotificationsSpecJSI>(params);
}

// MARK: - Event Emitter

- (NSArray<NSString *> *)supportedEvents {
  return @[
    @"AppAmbit_onForegroundNotification",
    @"AppAmbit_onBackgroundNotification",
    @"AppAmbit_onOpenedNotification"
  ];
}

- (void)startObserving {
  _hasListeners = YES;
}

// Called lazily the first time JS subscribes to any event — mirrors Flutter's
// installNotificationListenerIfNeeded. At this point _hasListeners is already
// YES (set by startObserving via [super addListener:]) so SDK cold-start replay
// can be sent immediately, exactly like Flutter's DispatchQueue.main.async trick.
- (void)installSDKListenerIfNeeded {
  if (_sdkListenerInstalled) return;
  _sdkListenerInstalled = YES;

  __weak AppambitPushNotifications *weakSelf = self;
  [AppAmbitPushWrapper setNotificationListener:^(NSDictionary * _Nonnull payload, NSInteger state) {
    AppambitPushNotifications *strongSelf = weakSelf;
    if (!strongSelf) return;

    if (state == 0) {
      // Foreground
      if (strongSelf->_hasListeners) {
        [strongSelf sendEventWithName:@"AppAmbit_onForegroundNotification" body:payload];
      } else {
        [strongSelf->_pendingForegroundEvents addObject:payload];
      }
    } else {
      // Opened/tapped — queue if app is still transitioning; applicationDidBecomeActive: flushes.
      // Do NOT call isDuplicateOpenedPayload: here — it marks the payload as seen even when
      // _hasListeners is NO, which would cause the subsequent flush in addListener: to skip it.
      BOOL appIsActive = [UIApplication sharedApplication].applicationState == UIApplicationStateActive;
      if (strongSelf->_hasListeners && appIsActive) {
        if (![strongSelf isDuplicateOpenedPayload:payload]) {
          [strongSelf sendEventWithName:@"AppAmbit_onOpenedNotification" body:payload];
        }
      } else {
        [strongSelf->_pendingOpenedEvents addObject:payload];
      }
    }
  }];
}

- (void)handleBackgroundNotification:(NSNotification *)notification {
  if (!notification.userInfo) return;
  if (_hasListeners) {
    [self sendEventWithName:@"AppAmbit_onBackgroundNotification" body:notification.userInfo];
  } else {
    [_pendingBackgroundEvents addObject:notification.userInfo];
  }
}

- (void)handleAppBecameActive:(NSNotification *)notification {
  NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
  if ([ud boolForKey:kPushPrefsKey]) {
    BOOL pendingEnabled = [ud boolForKey:kPushEnabledKey];
    __weak AppambitPushNotifications *weakSelf = self;
    [AppAmbitPushWrapper setNotificationsEnabled:pendingEnabled completion:^(BOOL success) {
      if (success) {
        [weakSelf clearPendingSync];
        [weakSelf stopNetworkMonitor];
      } else {
        [weakSelf startNetworkMonitor];
      }
    }];
  }

  if (!_hasListeners || _pendingOpenedEvents.count == 0) return;
  NSArray<NSDictionary *> *toSend = [_pendingOpenedEvents copy];
  [_pendingOpenedEvents removeAllObjects];
  for (NSDictionary *payload in toSend) {
    if (![self isDuplicateOpenedPayload:payload]) {
      [self sendEventWithName:@"AppAmbit_onOpenedNotification" body:payload];
    }
  }
}

- (void)handleOpenedNotification:(NSNotification *)notification {
  if (!notification.userInfo) return;
  // Only call isDuplicateOpenedPayload: when actually sending to JS.
  // Calling it when _hasListeners is NO would mark the payload as seen before it's
  // delivered, causing the addListener: flush to skip it (the payload never reaches JS).
  if (_hasListeners) {
    if (![self isDuplicateOpenedPayload:notification.userInfo]) {
      [self sendEventWithName:@"AppAmbit_onOpenedNotification" body:notification.userInfo];
    }
  } else {
    [_pendingOpenedEvents addObject:notification.userInfo];
  }
}

- (BOOL)isDuplicateOpenedPayload:(NSDictionary *)payload {
  static NSMutableArray<NSDictionary *> *sentPayloads = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sentPayloads = [NSMutableArray new];
  });

  for (NSDictionary *sent in sentPayloads) {
    if ([sent isEqualToDictionary:payload]) {
      return YES;
    }
  }

  [sentPayloads addObject:payload];
  if (sentPayloads.count > 10) {
    [sentPayloads removeObjectAtIndex:0];
  }
  return NO;
}

- (void)stopObserving {
  _hasListeners = NO;
}

- (void)dealloc {
  [self stopNetworkMonitor];
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

// MARK: - TurboModule Methods

- (void)start {
  [self flushPendingSyncIfNeeded];
  [AppAmbitPushWrapper start];
}

- (void)requestNotificationPermission {
  [AppAmbitPushWrapper requestNotificationPermissionWithListener:nil];
}

- (void)requestNotificationPermissionWithResult:(RCTPromiseResolveBlock)resolve
                                         reject:(RCTPromiseRejectBlock)reject {
  [AppAmbitPushWrapper requestNotificationPermissionWithListener:^(BOOL granted) {
    resolve(@(granted));
  }];
}

- (void)setNotificationsEnabled:(BOOL)enabled {
  [self savePendingSync:enabled];
  __weak AppambitPushNotifications *weakSelf = self;
  [AppAmbitPushWrapper setNotificationsEnabled:enabled completion:^(BOOL success) {
    if (success) {
      [weakSelf clearPendingSync];
      [weakSelf stopNetworkMonitor];
    } else {
      [weakSelf startNetworkMonitor];
    }
  }];
}

- (void)isNotificationsEnabled:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject {
  resolve(@([AppAmbitPushWrapper isNotificationsEnabled]));
}

- (void)hasNotificationPermission:(RCTPromiseResolveBlock)resolve
                            reject:(RCTPromiseRejectBlock)reject {
  [AppAmbitPushWrapper hasNotificationPermissionWithCompletion:^(BOOL granted) {
    resolve(@(granted));
  }];
}

// Called by JS when the background notification async handler Promise resolves.
// Signals the iOS system that background processing is complete so iOS can reclaim
// time and allow future background wake-ups.
- (void)backgroundHandlerCompleted {
  AppAmbitNotifyJSBackgroundHandlerCompleted();
}

// MARK: - Offline-resilient consumer sync

- (void)savePendingSync:(BOOL)enabled {
  NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
  [ud setBool:YES forKey:kPushPrefsKey];
  [ud setBool:enabled forKey:kPushEnabledKey];
  [ud synchronize];
}

- (void)clearPendingSync {
  NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
  [ud setBool:NO forKey:kPushPrefsKey];
  [ud synchronize];
}

- (void)flushPendingSyncIfNeeded {
  NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
  if (![ud boolForKey:kPushPrefsKey]) return;
  BOOL enabled = [ud boolForKey:kPushEnabledKey];
  __weak AppambitPushNotifications *weakSelf = self;
  [AppAmbitPushWrapper setNotificationsEnabled:enabled completion:^(BOOL success) {
    if (success) {
      [weakSelf clearPendingSync];
      [weakSelf stopNetworkMonitor];
    } else {
      [weakSelf startNetworkMonitor];
    }
  }];
}

// Monitors network path and retries the pending consumer sync as soon as
// connectivity is restored. Mirrors Android's ConnectivityManager.NetworkCallback.
// The monitor stays active until either clearPendingSync is called or the
// module is deallocated — it never gives up on its own.
- (void)startNetworkMonitor {
  [self stopNetworkMonitor];

  NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
  if (![ud boolForKey:kPushPrefsKey]) return;

  __weak AppambitPushNotifications *weakSelf = self;
  nw_path_monitor_t monitor = nw_path_monitor_create();
  _pathMonitor = monitor;

  nw_path_monitor_set_update_handler(monitor, ^(nw_path_t path) {
    if (nw_path_get_status(path) != nw_path_status_satisfied) return;

    AppambitPushNotifications *strongSelf = weakSelf;
    if (!strongSelf) return;

    NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
    if (![ud boolForKey:kPushPrefsKey]) {
      [strongSelf stopNetworkMonitor];
      return;
    }

    BOOL pendingEnabled = [ud boolForKey:kPushEnabledKey];
    dispatch_async(dispatch_get_main_queue(), ^{
      [AppAmbitPushWrapper setNotificationsEnabled:pendingEnabled completion:^(BOOL success) {
        if (success) {
          [strongSelf clearPendingSync];
          [strongSelf stopNetworkMonitor];
        }
        // On failure: keep monitor running; next path update will retry.
      }];
    });
  });

  nw_path_monitor_set_queue(monitor, dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0));
  nw_path_monitor_start(monitor);
}

- (void)stopNetworkMonitor {
  if (_pathMonitor) {
    nw_path_monitor_cancel(_pathMonitor);
    _pathMonitor = nil;
  }
}

- (void)addListener:(NSString *)eventName {
  [super addListener:eventName]; // sets _hasListeners = YES via startObserving

  // Install SDK listener once JS is ready — same as Flutter's installNotificationListenerIfNeeded.
  // _hasListeners is now YES so SDK cold-start replay fires sendEventWithName: directly.
  [self installSDKListenerIfNeeded];

  if ([eventName isEqualToString:@"AppAmbit_onBackgroundNotification"]) {
    for (NSDictionary *payload in _pendingBackgroundEvents) {
      [self sendEventWithName:@"AppAmbit_onBackgroundNotification" body:payload];
    }
    [_pendingBackgroundEvents removeAllObjects];
  } else if ([eventName isEqualToString:@"AppAmbit_onForegroundNotification"]) {
    for (NSDictionary *payload in _pendingForegroundEvents) {
      [self sendEventWithName:@"AppAmbit_onForegroundNotification" body:payload];
    }
    [_pendingForegroundEvents removeAllObjects];
  } else if ([eventName isEqualToString:@"AppAmbit_onOpenedNotification"]) {
    NSArray<NSDictionary *> *earlyOpened = [AppAmbitPushWrapper getAndClearPendingOpenedPayloads];
    if (earlyOpened.count > 0) {
      [_pendingOpenedEvents addObjectsFromArray:earlyOpened];
    }

    for (NSDictionary *payload in _pendingOpenedEvents) {
      if (![self isDuplicateOpenedPayload:payload]) {
        [self sendEventWithName:@"AppAmbit_onOpenedNotification" body:payload];
      }
    }
    [_pendingOpenedEvents removeAllObjects];
  }
}

- (void)removeListeners:(double)count {
  [super removeListeners:count];
}

@end
