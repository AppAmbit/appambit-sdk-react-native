#import "Appambit.h"
#import <Appambit-Swift.h>

@implementation AppAmbitCrashes
RCT_EXPORT_MODULE(AppAmbitCrashes);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitCrashesSpecJSI>(params);
}

- (nonnull NSNumber *)didCrashInLastSession {
    __block NSNumber *result = @(NO);

    [AppAmbitSdkWrapper didCrashInLastSessionWithCompletion:^(BOOL crashed) {
        result = @(crashed);
    }];

    return result;
}

- (void)generateTestCrash { 
  [AppAmbitSdkWrapper generateTestCrash];
}

- (void)logErrorMessage:(nonnull NSString *)errorTitle properties:(nonnull NSDictionary *)properties {
  [AppAmbitSdkWrapper logErrorWithMessage:errorTitle properties:properties];
}

- (void)logError:(JS::NativeAppambitCrashes::ErrorPayload &)payload {
  
}


@end
