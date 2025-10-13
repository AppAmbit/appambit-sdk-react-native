#import "Appambit.h"

@implementation AppAmbitAnalytics
RCT_EXPORT_MODULE(AppAmbitAnalytics);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitAnalyticsSpecJSI>(params);
}

- (void)clearToken { 
  
}

- (void)enableManualSession { 
  
}

- (void)endSession { 
  
}

- (void)generateTestEvent { 
  
}

- (void)setUserEmail:(nonnull NSString *)email { 
  
}

- (void)setUserId:(nonnull NSString *)userId { 
  
}

- (void)startSession { 
  
}

- (void)trackEvent:(nonnull NSString *)eventTitle properties:(nonnull NSDictionary *)properties { 
  
}

@end
