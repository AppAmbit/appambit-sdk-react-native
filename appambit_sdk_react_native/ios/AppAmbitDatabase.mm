#import "AppAmbitDatabase.h"
#import <Appambit-Swift.h>

@implementation AppAmbitDatabase
RCT_EXPORT_MODULE(AppAmbitDatabase);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitDatabaseSpecJSI>(params);
}

- (void)execute:(NSString *)sql
         params:(NSArray *)params
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
    [AppAmbitSdkWrapper dbExecute:sql
                           params:(params.count > 0 ? params : nil)
                       completion:^(NSDictionary * _Nullable result, NSError * _Nullable error) {
        if (error) {
            reject(@"DB_EXECUTE_ERROR", error.localizedDescription, error);
        } else {
            resolve(result ?: @{});
        }
    }];
}

- (void)batch:(NSArray *)statements
  transaction:(BOOL)transaction
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
    [AppAmbitSdkWrapper dbBatch:statements
                    transaction:transaction
                     completion:^(NSArray * _Nullable results, NSError * _Nullable error) {
        if (error) {
            reject(@"DB_BATCH_ERROR", error.localizedDescription, error);
        } else {
            resolve(results ?: @[]);
        }
    }];
}

@end
