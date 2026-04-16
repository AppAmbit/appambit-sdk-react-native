#import "AppAmbitCms.h"
#import "Appambit.h"
#import <Appambit-Swift.h>
#import <Foundation/Foundation.h>
@class CmsQueryObjC;
@interface CmsQueryObjC : NSObject
- (instancetype)search:(NSString *)query;
- (instancetype)equals:(NSString *)field value:(NSString *)value;
- (instancetype)notEquals:(NSString *)field value:(NSString *)value;
- (instancetype)contains:(NSString *)field value:(NSString *)value;
- (instancetype)startsWith:(NSString *)field value:(NSString *)value;
- (instancetype)greaterThan:(NSString *)field value:(id)value;
- (instancetype)greaterThanOrEqual:(NSString *)field value:(id)value;
- (instancetype)lessThan:(NSString *)field value:(id)value;
- (instancetype)lessThanOrEqual:(NSString *)field value:(id)value;
- (instancetype)inList:(NSString *)field values:(NSArray<NSString *> *)values;
- (instancetype)notInList:(NSString *)field values:(NSArray<NSString *> *)values;
- (instancetype)orderByAscending:(NSString *)field;
- (instancetype)orderByDescending:(NSString *)field;
- (instancetype)getPage:(NSInteger)page;
- (instancetype)getPerPage:(NSInteger)perPage;
- (void)getListWithCompletion:(void (^)(NSArray<id> *))completion;
@end

@implementation AppAmbitCms
RCT_EXPORT_MODULE(AppAmbitCms);

static NSMutableDictionary<NSString *, NSMutableArray<RCTPromiseResolveBlock> *> *pendingResolves = nil;
static NSLock *pendingLock = nil;
static NSMutableDictionary<NSString *, NSArray<id> *> *cmsCache = nil;

+ (void)initialize {
    if (self == [AppAmbitCms class]) {
        pendingResolves = [NSMutableDictionary new];
        pendingLock = [[NSLock alloc] init];
        cmsCache = [NSMutableDictionary new];
    }
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAppambitCmsSpecJSI>(params);
}

- (void)getList:(NSString *)contentType
        filters:(NSArray *)filters
        resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject {

    NSString *cacheKey = contentType;
    if (filters && [filters isKindOfClass:[NSArray class]] && filters.count > 0) {
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:filters options:0 error:nil];
        if (jsonData) {
            NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
            cacheKey = [NSString stringWithFormat:@"%@_%@", contentType, jsonString];
        }
    }
    
    [pendingLock lock];
    
    if (cmsCache[cacheKey] != nil) {
        [pendingLock unlock];
        resolve(cmsCache[cacheKey]);
        return;
    }
    
    if (pendingResolves[cacheKey] != nil) {
        [pendingResolves[cacheKey] addObject:resolve];
        [pendingLock unlock];
        return;
    }
    
    pendingResolves[cacheKey] = [NSMutableArray arrayWithObject:resolve];
    [pendingLock unlock];

    CmsQueryObjC *query = [AppAmbitSdkWrapper getCmsQueryWithContentType:contentType];
    
    if (filters && [filters isKindOfClass:[NSArray class]]) {
        for (NSDictionary *filter in filters) {
            if ([filter isKindOfClass:[NSDictionary class]]) {
                if (filter[@"method"]) {
                    NSString *method = filter[@"method"];
                    NSArray *args = filter[@"args"];
                    
                    if (args && [args isKindOfClass:[NSArray class]]) {
                        if ([method isEqualToString:@"search"] && args.count > 0) {
                            [query search:[NSString stringWithFormat:@"%@", args[0]]];
                        } else if ([method isEqualToString:@"startsWith"] && args.count > 1) {
                            [query startsWith:[NSString stringWithFormat:@"%@", args[0]] value:[NSString stringWithFormat:@"%@", args[1]]];
                        } else if ([method isEqualToString:@"inList"] && args.count > 1) {
                            if ([args[1] isKindOfClass:[NSArray class]]) {
                                [query inList:[NSString stringWithFormat:@"%@", args[0]] values:(NSArray<NSString *> *)args[1]];
                            }
                        } else if ([method isEqualToString:@"notInList"] && args.count > 1) {
                            if ([args[1] isKindOfClass:[NSArray class]]) {
                                [query notInList:[NSString stringWithFormat:@"%@", args[0]] values:(NSArray<NSString *> *)args[1]];
                            }
                        } else if ([method isEqualToString:@"orderByAscending"] && args.count > 0) {
                            [query orderByAscending:[NSString stringWithFormat:@"%@", args[0]]];
                        } else if ([method isEqualToString:@"orderByDescending"] && args.count > 0) {
                            [query orderByDescending:[NSString stringWithFormat:@"%@", args[0]]];
                        } else if ([method isEqualToString:@"getPage"] && args.count > 0) {
                            [query getPage:[args[0] intValue]];
                        } else if ([method isEqualToString:@"getPerPage"] && args.count > 0) {
                            [query getPerPage:[args[0] intValue]];
                        }
                    }
                } else if (filter[@"field"] && filter[@"operator"]) {
                    NSString *field = filter[@"field"];
                    NSString *op = filter[@"operator"];
                    id value = filter[@"value"];
                    
                    if (value) {
                        if ([value isKindOfClass:[NSNumber class]]) {
                            NSNumber *numValue = (NSNumber *)value;
                            if ([op isEqualToString:@">"]) {
                                [query greaterThan:field value:numValue];
                            } else if ([op isEqualToString:@">="]) {
                                [query greaterThanOrEqual:field value:numValue];
                            } else if ([op isEqualToString:@"<"]) {
                                [query lessThan:field value:numValue];
                            } else if ([op isEqualToString:@"<="]) {
                                [query lessThanOrEqual:field value:numValue];
                            } else if ([op isEqualToString:@"="]) {
                                [query equals:field value:[numValue stringValue]];
                            } else if ([op isEqualToString:@"!="]) {
                                [query notEquals:field value:[numValue stringValue]];
                            }
                        } else {
                            NSString *strValue = [NSString stringWithFormat:@"%@", value];
                            if ([op isEqualToString:@"="]) {
                                [query equals:field value:strValue];
                            } else if ([op isEqualToString:@"!="]) {
                                [query notEquals:field value:strValue];
                            } else if ([op isEqualToString:@"LIKE"]) {
                                [query contains:field value:strValue];
                            }
                        }
                    }
                }
            }
        }
    }
    
    [query getListWithCompletion:^(NSArray<id> * _Nonnull items) {
        [pendingLock lock];
        
        if (items) {
            cmsCache[cacheKey] = items;
        }
        
        NSArray<RCTPromiseResolveBlock> *resolves = pendingResolves[cacheKey];
        [pendingResolves removeObjectForKey:cacheKey];
        [pendingLock unlock];
        
        for (RCTPromiseResolveBlock res in resolves) {
            res(items);
        }
    }];
}

- (void)clearCache:(NSString *)contentType {
    [pendingLock lock];
    NSMutableArray *keysToRemove = [NSMutableArray new];
    for (NSString *key in cmsCache.allKeys) {
        if ([key isEqualToString:contentType] || [key hasPrefix:[NSString stringWithFormat:@"%@_", contentType]]) {
            [keysToRemove addObject:key];
        }
    }
    [cmsCache removeObjectsForKeys:keysToRemove];
    [pendingLock unlock];

    [AppAmbitSdkWrapper clearCmsCacheWithContentType:contentType];
}

- (void)clearAllCache {
    [pendingLock lock];
    [cmsCache removeAllObjects];
    [pendingLock unlock];

    [AppAmbitSdkWrapper clearAllCmsCache];
}

@end
