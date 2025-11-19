#import "Appambit.h"
#import <Appambit-Swift.h>

@implementation AppAmbitAnalytics
RCT_EXPORT_MODULE(AppAmbitAnalytics);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitAnalyticsSpecJSI>(params);
}

- (void)clearToken { 
  [AppAmbitSdkWrapper clearToken];
}

- (void)enableManualSession { 
  [AppAmbitSdkWrapper enableManualSession];
}

- (void)startSession {
  [AppAmbitSdkWrapper startSession];
}

- (void)endSession { 
  [AppAmbitSdkWrapper endSession];
}

- (void)generateTestEvent { 
  [AppAmbitSdkWrapper generateTestEvent];
}

- (void)setUserEmail:(nonnull NSString *)email { 
  [AppAmbitSdkWrapper setUserEmailWithUserEmail:email];
}

- (void)setUserId:(nonnull NSString *)userId { 
  [AppAmbitSdkWrapper setUserIdWithUserId:userId];
}

- (void)trackEvent:(nonnull NSString *)eventTitle properties:(nonnull NSDictionary *)properties { 
  [AppAmbitSdkWrapper trackEventWithEventTitle:eventTitle properties:properties];
}

@end
