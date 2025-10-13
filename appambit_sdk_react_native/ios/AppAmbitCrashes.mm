#import "Appambit.h"

@implementation AppAmbitCrashes
RCT_EXPORT_MODULE(AppAmbitCrashes);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitCrashesSpecJSI>(params);
}

- (nonnull NSNumber *)didCrashInLastSession { 
  return @true;
}

- (void)generateTestCrash { 
  
}

- (void)logError:(JS::NativeAppambitCrashes::ErrorPayload &)payload { 
  
}

- (void)logErrorMessage:(nonnull NSString *)message properties:(nonnull NSDictionary *)properties { 
  
}

@end
