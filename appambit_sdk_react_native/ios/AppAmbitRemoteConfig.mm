#import "AppAmbitRemoteConfig.h"
#import <Appambit-Swift.h>

@implementation AppAmbitRemoteConfig
RCT_EXPORT_MODULE(AppAmbitRemoteConfig);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitRemoteConfigSpecJSI>(params);
}

- (void)enable {
  [AppAmbitSdkWrapper enableRemoteConfig];
}

- (nonnull NSString *)getString:(nonnull NSString *)key {
  return [AppAmbitSdkWrapper getRemoteConfigStringWithKey:key];
}

- (NSNumber *)getBoolean:(NSString *)key {
  return @([AppAmbitSdkWrapper getRemoteConfigBooleanWithKey:key]);
}

- (NSNumber *)getInt:(NSString *)key {
  return @([AppAmbitSdkWrapper getRemoteConfigIntWithKey:key]);
}

- (NSNumber *)getDouble:(NSString *)key {
  return @([AppAmbitSdkWrapper getRemoteConfigDoubleWithKey:key]);
}

@end
