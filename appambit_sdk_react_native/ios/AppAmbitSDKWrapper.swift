import Foundation
import AppAmbit

@objc(AppAmbitSdkWrapper)
public class AppAmbitSDKWrapper: NSObject {
  
  @objc public static let shared = AppAmbitSDKWrapper()
  
  // MARK: - Core
  @objc
  public static func start(appKey: String) {
    AppAmbit.start(appKey: appKey)
  }

  // MARK: Breadcrumbs
  @objc
  public static func addBreadcrumb(name: String) {
    AppAmbit.addBreadcrumb(name: name)
  }
  
  // MARK: - Analytics
  @objc
  public static func setUserId(userId: String) {
    Analytics.setUserId(userId)
  }
  
  @objc
  public static func setUserEmail(userEmail: String) {
    Analytics.setEmail(userEmail)
  }
  
  @objc
  public static func clearToken() {
    Analytics.clearToken()
  }
  
  @objc
  public static func startSession() {
    Analytics.startSession()
  }
  
  @objc
  public static func endSession() {
    Analytics.endSession()
  }

  @objc
  public static func enableManualSession() {
    Analytics.enableManualSession()
  }
  
  @objc
  public static func trackEvent(eventTitle: String, properties: [String: String]? = nil) {
      Analytics.trackEvent(eventTitle: eventTitle, data: properties ?? [:])
  }
  
  @objc
  public static func generateTestEvent() {
    Analytics.generateTestEvent()
  }
  
  // MARK: - Crashes
  @objc
  public static func didCrashInLastSession(completion: @escaping (Bool) -> Void) {
      Crashes.didCrashInLastSession { crashed in
          completion(crashed)
      }
  }

  @objc
  public static func generateTestCrash() {
    Crashes.generateTestCrash()
  }

  @objc
  public static func logError(message: String, properties: [String: String]? = nil) {
    Crashes.logError(message: message, properties: properties)
  }

  @objc
  public static func logError(exception: Error, properties: [String: String]? = nil) {
    Crashes.logError(exception: exception, properties: properties)
  }

  // MARK: - RemoteConfig
  @objc
  public static func enableRemoteConfig() {
    RemoteConfig.enable()
  }

  @objc
  public static func getRemoteConfigString(key: String) -> String {
    return RemoteConfig.getString(key)
  }

  @objc
  public static func getRemoteConfigBoolean(key: String) -> Bool {
    return RemoteConfig.getBoolean(key)
  }

  @objc
  public static func getRemoteConfigLong(key: String) -> Int64 {
    return RemoteConfig.getLong(key)
  }

  @objc
  public static func getRemoteConfigDouble(key: String) -> Double {
    return RemoteConfig.getDouble(key)
  }

  // MARK: - CMS
  @objc
  public static func getCmsQuery(contentType: String) -> CmsQueryObjC {
      return Cms.contentTypelessObjC(contentType)
  }

  // MARK: - Database

  @objc
  public static func dbExecute(
    _ sql: String,
    params: [Any]?,
    completion: @escaping @Sendable ([String: Any]?, Error?) -> Void
  ) {
    if let params = params, !params.isEmpty {
      AppAmbitDb.execute(sql, params: params) { result, error in
        completion(result.map { Self.dbResultToDict($0) }, error)
      }
    } else {
      AppAmbitDb.execute(sql) { result, error in
        completion(result.map { Self.dbResultToDict($0) }, error)
      }
    }
  }

  @objc
  public static func dbBatch(
    _ statements: [[String: Any]],
    transaction: Bool,
    completion: @escaping @Sendable ([Any]?, Error?) -> Void
  ) {
    let dbStatements: [DbStatement] = statements.compactMap { dict in
      guard let sql = dict["sql"] as? String else { return nil }
      let params = dict["params"] as? [Any]
      return params != nil ? DbStatement.of(sql, params: params!) : DbStatement.of(sql)
    }

    let finish: @Sendable ([DbResult]?, Error?) -> Void = { results, error in
      if let error = error { completion(nil, error); return }
      let dicts = results?.map { Self.dbResultToDict($0) } ?? []
      completion(dicts, nil)
    }

    if transaction {
      AppAmbitDb.batchInTransaction(dbStatements, completion: finish)
    } else {
      AppAmbitDb.batch(dbStatements, completion: finish)
    }
  }

  private static func dbResultToDict(_ result: DbResult) -> [String: Any] {
    var dict: [String: Any] = [
      "columns": result.columns,
      "rows": result.rows.map { row in row.map { $0 is NSNull ? NSNull() : $0 } },
      "rowsRead": result.rowsRead,
      "rowsWritten": result.rowsWritten,
    ]
    if let err = result.error { dict["error"] = err }
    return dict
  }

}
