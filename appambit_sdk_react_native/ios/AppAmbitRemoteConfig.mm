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

- (BOOL)getBoolean:(nonnull NSString *)key {
  return [AppAmbitSdkWrapper getRemoteConfigBooleanWithKey:key];
}

- (double)getInt:(nonnull NSString *)key {
  return (double)[AppAmbitSdkWrapper getRemoteConfigIntWithKey:key];
}

- (double)getDouble:(nonnull NSString *)key {
  return [AppAmbitSdkWrapper getRemoteConfigDoubleWithKey:key];
}

@end
