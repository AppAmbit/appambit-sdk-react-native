#import "AppambitPushNotifications.h"
#import <AppAmbitSdkPushNotifications-Swift.h>

@implementation AppambitPushNotifications {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE(AppambitPushNotifications)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitPushNotificationsSpecJSI>(params);
}

// MARK: - Event Emitter

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onNotificationReceived"];
}

- (void)startObserving {
  _hasListeners = YES;
}

- (void)stopObserving {
  _hasListeners = NO;
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
  __weak AppambitPushNotifications *weakSelf = self;
  [AppAmbitPushWrapper setNotificationCustomizer:^(NSDictionary * _Nonnull payload) {
    AppambitPushNotifications *strongSelf = weakSelf;
    if (strongSelf && strongSelf->_hasListeners) {
      [strongSelf sendEventWithName:@"onNotificationReceived" body:payload];
    }
  }];
}

- (void)addListener:(NSString *)eventName {
  // Required by RCTEventEmitter - no-op
}

- (void)removeListeners:(double)count {
  // Required by RCTEventEmitter - no-op
}

@end
