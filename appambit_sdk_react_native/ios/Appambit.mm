#import "Appambit.h"

@implementation AppAmbit
RCT_EXPORT_MODULE(AppAmbitCore);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitCoreSpecJSI>(params);
}


- (void)start:(nonnull NSString *)appkey {
  
}

@end
