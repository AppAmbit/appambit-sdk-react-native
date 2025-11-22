#import "Appambit.h"
#import <Appambit-Swift.h>

@implementation AppAmbitCrashes
RCT_EXPORT_MODULE(AppAmbitCrashes);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitCrashesSpecJSI>(params);
}

- (void)didCrashInLastSession:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject {
    [AppAmbitSdkWrapper didCrashInLastSessionWithCompletion:^(BOOL crashed) {
        resolve(@(crashed));
    }];
}

- (void)generateTestCrash { 
  [AppAmbitSdkWrapper generateTestCrash];
}

- (void)logErrorMessage:(nonnull NSString *)errorTitle properties:(nonnull NSDictionary *)properties {
  [AppAmbitSdkWrapper logErrorWithMessage:errorTitle properties:properties];
}

- (void)logError:(JS::NativeAppambitCrashes::ErrorPayload &)payload {

    NSString *rawMessage = payload.message();
    NSString *stack = payload.stack();
    NSString *classFqn = payload.classFqn() ?: @"JSException";
    NSString *fileName = payload.fileName();
    NSNumber *lineNumber = payload.lineNumber().has_value()
        ? @(payload.lineNumber().value())
        : nil;

    NSDictionary *rawProps = nil;
    if ([payload.properties() isKindOfClass:[NSDictionary class]]) {
        rawProps = (NSDictionary *)payload.properties();
    }

    NSString *derivedMessage = @"JS Error";
    if (stack && stack.length > 0) {
        NSArray *lines = [stack componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]];
        if (lines.count > 0) {
            derivedMessage = lines.firstObject;
        }
    }

    NSString *finalMessage = (rawMessage && ![rawMessage isEqualToString:@"{}"] && rawMessage.length > 0)
        ? rawMessage
        : derivedMessage;

    NSMutableDictionary<NSString*, NSString*> *properties = [NSMutableDictionary dictionary];
    if (rawProps) {
        [rawProps enumerateKeysAndObjectsUsingBlock:^(id key, id value, BOOL *stop) {
            properties[key] = [value description];
        }];
    }

    NSMutableDictionary *userInfo = [@{
        NSLocalizedDescriptionKey: finalMessage,
        @"classFqn": classFqn ?: @"Unknown"
    } mutableCopy];

    if (stack) userInfo[@"stackTrace"] = stack;
    if (fileName) userInfo[@"fileName"] = fileName;
    if (lineNumber) userInfo[@"lineNumber"] = lineNumber;
    if (properties.count > 0) userInfo[@"properties"] = properties;

    NSError *error = [NSError errorWithDomain:@"com.appambit.react.error"
                                         code:-1
                                     userInfo:userInfo];

    [AppAmbitSdkWrapper logErrorWithException:error properties:properties];
}


@end
