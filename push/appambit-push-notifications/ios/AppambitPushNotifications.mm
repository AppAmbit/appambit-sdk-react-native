#import "AppambitPushNotifications.h"
#import <AppAmbitSdkPushNotifications-Swift.h>

// Defined in AppAmbitNotificationSwizzler.m — call when JS background handler resolves
extern "C" void AppAmbitNotifyJSBackgroundHandlerCompleted(void);

static NSString * const kPushEnabledStateKey = @"appambit_push_enabled_state";
static NSString * const kPushHasStateKey     = @"appambit_push_has_enabled_state";
// Pending consumer-sync intent: the last value the user toggled that has not yet
// been confirmed as delivered to the backend. Replayed when connectivity returns.
static NSString * const kPushPendingKey      = @"appambit_push_pending_sync";
static NSString * const kPushPendingValueKey = @"appambit_push_pending_value";

@implementation AppambitPushNotifications {
  BOOL _hasListeners;
  BOOL _sdkListenerInstalled;
  NSMutableArray<NSDictionary *> *_pendingBackgroundEvents;
  NSMutableArray<NSDictionary *> *_pendingOpenedEvents;
  NSMutableArray<NSDictionary *> *_pendingForegroundEvents;
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

    // Replay any deferred consumer sync as soon as the network comes back.
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleNetworkAvailable:)
                                                 name:@"AppAmbit_networkAvailable"
                                               object:nil];
    [AppAmbitPushWrapper startNetworkMonitor];
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
  // The SDK has had time to finish its async init (and register the device token)
  // by the time the app becomes active, so this is a safe place to replay a
  // deferred consumer sync (covers "toggle offline → reopen online").
  [self flushPendingConsumerSync];

  if (!_hasListeners || _pendingOpenedEvents.count == 0) return;
  NSArray<NSDictionary *> *toSend = [_pendingOpenedEvents copy];
  [_pendingOpenedEvents removeAllObjects];
  for (NSDictionary *payload in toSend) {
    if (![self isDuplicateOpenedPayload:payload]) {
      [self sendEventWithName:@"AppAmbit_onOpenedNotification" body:payload];
    }
  }
}

- (void)handleNetworkAvailable:(NSNotification *)notification {
  [self flushPendingConsumerSync];
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
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

// MARK: - TurboModule Methods

- (void)start {
  // Initialize the SDK. Do NOT call flushPendingSyncIfNeeded here — PushNotifications.start()
  // registers the device token asynchronously, so getCurrentToken() returns nil immediately
  // after start(), causing updateConsumer to fail. handleAppBecameActive: fires after the SDK
  // has had time to complete its async init and is the correct place to flush pending sync.
  [AppAmbitPushWrapper start];
}

- (void)requestNotificationPermission {
  [AppAmbitPushWrapper requestNotificationPermissionWithListener:nil];
}

- (void)requestNotificationPermissionWithResult:(RCTPromiseResolveBlock)resolve
                                         reject:(RCTPromiseRejectBlock)reject {
  [AppAmbitPushWrapper requestNotificationPermissionWithListener:^(BOOL granted) {
    if (granted) {
      // Cache immediately so hasNotificationPermission() returns true on next
      // restart even if the system permission resets (e.g. simulator reinstall).
      [[NSUserDefaults standardUserDefaults] setBool:YES forKey:@"appambit_push_has_permission"];
      [[NSUserDefaults standardUserDefaults] synchronize];
    }
    resolve(@(granted));
  }];
}

- (void)setNotificationsEnabled:(BOOL)enabled {
  NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
  // 1. Persist the user's intended state for UI consistency across restarts.
  [ud setBool:enabled forKey:kPushEnabledStateKey];
  [ud setBool:YES forKey:kPushHasStateKey];
  // 2. Record a pending consumer-sync intent. It is cleared only once the
  //    backend update actually succeeds (see flushPendingConsumerSync).
  [ud setBool:enabled forKey:kPushPendingValueKey];
  [ud setBool:YES forKey:kPushPendingKey];
  [ud synchronize];
  // 3. Update the SDK's local enabled flag (no network) so cold-start token
  //    sync knows the user's intent.
  [AppAmbitPushWrapper setNotificationsEnabledLocal:enabled];
  // 4. Try to push it to the backend now. When offline this is a no-op: calling
  //    updateConsumer offline poisons the SDK's dedup cache (it writes the new
  //    state to its DB before the failed network send, so identical retries are
  //    skipped as "already synced"). The pending intent is replayed when the
  //    network returns or the app becomes active.
  [self flushPendingConsumerSync];
}

- (void)isNotificationsEnabled:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject {
  NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
  if ([ud boolForKey:kPushHasStateKey]) {
    // Return our own persisted state — this is always the last value the user
    // explicitly set, survives cold restarts and SDK state inconsistencies.
    resolve(@([ud boolForKey:kPushEnabledStateKey]));
  } else {
    // First-ever launch: no stored state yet, ask the SDK.
    resolve(@([AppAmbitPushWrapper isNotificationsEnabled]));
  }
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

// Replays the pending consumer-sync intent to the backend when online. The SDK
// has no offline retry queue and dedups consumer updates against its local DB,
// so we must only call updateConsumer with real connectivity. The pending flag
// is cleared only on a confirmed successful backend update.
- (void)flushPendingConsumerSync {
  NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
  if (![ud boolForKey:kPushPendingKey]) return;
  if (![AppAmbitPushWrapper isNetworkAvailable]) return;

  BOOL desired = [ud boolForKey:kPushPendingValueKey];
  [AppAmbitPushWrapper setNotificationsEnabled:desired completion:^(BOOL success) {
    if (!success) return;
    NSUserDefaults *u = [NSUserDefaults standardUserDefaults];
    // Only clear if the pending value still matches what we just synced — a
    // newer toggle during the network call must keep its own pending intent.
    if ([u boolForKey:kPushPendingKey] && [u boolForKey:kPushPendingValueKey] == desired) {
      [u removeObjectForKey:kPushPendingKey];
      [u removeObjectForKey:kPushPendingValueKey];
      [u synchronize];
    }
  }];
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
