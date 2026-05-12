#import "AppambitPushNotifications.h"
#import <AppAmbitSdkPushNotifications-Swift.h>

@implementation AppambitPushNotifications {
  BOOL _hasListeners;
  NSMutableArray<NSDictionary *> *_pendingBackgroundEvents;
  NSMutableArray<NSDictionary *> *_pendingOpenedEvents;
  NSMutableArray<NSDictionary *> *_pendingForegroundEvents;
}

RCT_EXPORT_MODULE(AppambitPushNotifications)

- (instancetype)init {
  self = [super init];
  if (self) {
    _pendingBackgroundEvents = [NSMutableArray new];
    _pendingOpenedEvents = [NSMutableArray new];
    _pendingForegroundEvents = [NSMutableArray new];
    
    // Grab any payloads that arrived before this class was even initialized
    NSArray<NSDictionary *> *earlyPayloads = [AppAmbitPushWrapper getAndClearPendingBackgroundPayloads];
    if (earlyPayloads) {
      [_pendingBackgroundEvents addObjectsFromArray:earlyPayloads];
    }
    
    // Register for NSNotificationCenter immediately in init, not startObserving
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleBackgroundNotification:)
                                                 name:@"AppAmbit_onBackgroundNotification"
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
  [self setupListeners];
}

- (void)setupListeners {
  __weak AppambitPushNotifications *weakSelf = self;
  [AppAmbitPushWrapper setNotificationListener:^(NSDictionary * _Nonnull payload, NSInteger state) {
    AppambitPushNotifications *strongSelf = weakSelf;
    if (strongSelf) {
      NSString *eventName = state == 0 ? @"AppAmbit_onForegroundNotification" : @"AppAmbit_onOpenedNotification";
      if (strongSelf->_hasListeners) {
        [strongSelf sendEventWithName:eventName body:payload];
      } else {
        if (state == 0) {
          [strongSelf->_pendingForegroundEvents addObject:payload];
        } else {
          [strongSelf->_pendingOpenedEvents addObject:payload];
        }
      }
    }
  }];
}

- (void)handleBackgroundNotification:(NSNotification *)notification {
  if (notification.userInfo) {
    if (_hasListeners) {
      [self sendEventWithName:@"AppAmbit_onBackgroundNotification" body:notification.userInfo];
    } else {
      [_pendingBackgroundEvents addObject:notification.userInfo];
    }
  }
}

- (void)stopObserving {
  _hasListeners = NO;
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

// MARK: - TurboModule Methods

- (void)start {
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
  [AppAmbitPushWrapper setNotificationsEnabled:enabled];
}

- (void)isNotificationsEnabled:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject {
  resolve(@([AppAmbitPushWrapper isNotificationsEnabled]));
}

- (void)setNotificationCustomizer {
  // Legacy, no-op on iOS. Handled via setupListeners when startObserving is called.
}

- (void)addListener:(NSString *)eventName {
  [super addListener:eventName];
  
  // Flush pending events specifically for the listener that was just added!
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
    for (NSDictionary *payload in _pendingOpenedEvents) {
      [self sendEventWithName:@"AppAmbit_onOpenedNotification" body:payload];
    }
    [_pendingOpenedEvents removeAllObjects];
  }
}

- (void)removeListeners:(double)count {
  [super removeListeners:count];
}

@end
