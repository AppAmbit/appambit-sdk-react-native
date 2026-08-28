#import "AppAmbitCloudCode.h"
#import <Appambit-Swift.h>

@implementation AppAmbitCloudCode
RCT_EXPORT_MODULE(AppAmbitCloudCode);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitCloudCodeSpecJSI>(params);
}

- (void)call:(NSString *)requestId
          fn:(NSString *)fn
      method:(NSString *)method
       query:(NSDictionary *)query
        body:(NSDictionary *)body
     headers:(NSDictionary *)headers
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject
{
    // query/headers are passed through as plain NSDictionary — AppAmbitSdkWrapper.cloudCodeCall
    // takes [String: Any] specifically so it can type-check each value itself instead of this
    // call site casting to NSDictionary<NSString*, NSString*>*, which was a compile-time-only
    // annotation that did nothing to stop Swift's implicit bridging from trapping on a
    // non-string value.
    [AppAmbitSdkWrapper cloudCodeCall:requestId
                             function:fn
                               method:method
                                query:query
                                 body:body
                              headers:headers
                           completion:^(NSDictionary * _Nullable result, NSError * _Nullable error) {
        if (error) {
            NSString *code = error.userInfo[@"code"];
            reject(code ?: @"UNKNOWN", error.localizedDescription, error);
        } else {
            resolve(result ?: @{});
        }
    }];
}

- (void)cancel:(NSString *)requestId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
    [AppAmbitSdkWrapper cloudCodeCancel:requestId
                              completion:^(NSError * _Nullable error) {
        resolve(nil);
    }];
}

// RCTInvalidating: called by React Native when this module's bridge is torn down (a JS
// reload, not Fast Refresh). Cancels and clears any Cloud Code requests still pending so
// their native completion closures don't outlive the bridge that owns their JS promises.
// Mirrors AppambitCloudCodeModule.kt's `invalidate()` override on Android — this module is
// the only one on iOS holding state between calls, so it's the only one that needs this.
- (void)invalidate
{
    [AppAmbitSdkWrapper cloudCodeInvalidate];
}

@end
