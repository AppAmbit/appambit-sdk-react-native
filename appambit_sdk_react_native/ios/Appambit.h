#import <AppambitSpec/AppambitSpec.h>

@interface AppAmbitModule : NSObject <NativeAppambitCoreSpec>

@end

@interface AppAmbitCrashes : NSObject <NativeAppambitCrashesSpec>

@end

@interface AppAmbitAnalytics : NSObject <NativeAppambitAnalyticsSpec>

@end

@interface AppAmbitRemoteConfig : NSObject <NativeAppambitRemoteConfigSpec>

@end