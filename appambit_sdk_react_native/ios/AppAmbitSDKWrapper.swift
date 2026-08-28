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
    let dbStatements: [DbStatement] = statements.compactMap { dict -> DbStatement? in
      guard let sql = dict["sql"] as? String else { return nil }
      let params = dict["params"] as? [Any]
      return DbStatement(sql: sql, params: params)
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

  // MARK: - CloudCode

  // CloudCode itself has no requestId-keyed bookkeeping (each call() returns one fresh
  // CloudCodeCancellationToken scoped to that call only) and cancelling never invokes the
  // completion at all — it's simply never called again. So this module owns the only map of
  // in-flight requests, guarded by a lock the same way CloudCode's own token guards its single
  // cancelled flag internally. Each entry keeps both the cancellation token *and* the original
  // `cloudCodeCall` completion block, so `cloudCodeCancel`/`cloudCodeInvalidate` can settle the
  // original TurboModule promise immediately instead of leaving it to resolve on its own once
  // the underlying transport eventually completes or times out (mirrors
  // AppambitCloudCodeModule.kt's `PendingRequest(request, promise)` on Android).
  private final class CloudCodePendingRequest {
    // Optional and assigned *after* CloudCode.call(...) returns: the entry must be registered
    // in `cloudCodePending` before that call happens (see cloudCodeCall below), so at
    // registration time the token doesn't exist yet. `token?.cancel()` is a safe no-op if a
    // cancel/invalidate races in during that narrow window before the assignment lands.
    var token: CloudCodeCancellationToken?
    let completion: @Sendable (NSDictionary?, NSError?) -> Void

    init(completion: @escaping @Sendable (NSDictionary?, NSError?) -> Void) {
      self.completion = completion
    }
  }

  private static var cloudCodePending: [String: CloudCodePendingRequest] = [:]
  private static let cloudCodeLock = NSLock()

  private static func cloudCodeHttpMethod(from raw: String) -> CloudCodeHttpMethod? {
    switch raw {
    case "GET": return .get
    case "POST": return .post
    case "PUT": return .put
    case "PATCH": return .patch
    case "DELETE": return .delete
    default: return nil
    }
  }

  private static func cloudCodeMakeError(
    code: String,
    message: String,
    function: String? = nil,
    header: String? = nil,
    statusCode: Int? = nil,
    body: Any? = nil,
    rawBody: String? = nil,
    requestId: String? = nil
  ) -> NSError {
    var userInfo: [String: Any] = [
      "code": code,
      NSLocalizedDescriptionKey: message,
    ]
    if let function = function { userInfo["function"] = function }
    if let header = header { userInfo["header"] = header }
    if let statusCode = statusCode { userInfo["statusCode"] = statusCode }
    if let body = body { userInfo["body"] = body }
    if let rawBody = rawBody { userInfo["rawBody"] = rawBody }
    if let requestId = requestId { userInfo["requestId"] = requestId }
    return NSError(domain: "com.appambit.reactnative.cloudcode", code: 0, userInfo: userInfo)
  }

  // Pattern-matches the native Swift `CloudCodeError` enum directly (before it would get
  // boxed to NSError by the Obj-C bridge) so the resulting userInfo keys are the same,
  // predictable, flat shape on both platforms instead of depending on however
  // `CloudCodeError.errorUserInfo` happens to bridge.
  private static func cloudCodeCanonicalError(from error: Error) -> NSError {
    guard let cloudCodeError = error as? CloudCodeError else {
      return cloudCodeMakeError(code: "UNKNOWN", message: error.localizedDescription)
    }
    switch cloudCodeError {
    case .notInitialized:
      return cloudCodeMakeError(code: "NOT_INITIALIZED", message: cloudCodeError.localizedDescription ?? "Cloud Code is not initialized")
    case .invalidFunction(let function):
      return cloudCodeMakeError(code: "INVALID_FUNCTION", message: cloudCodeError.localizedDescription ?? "Invalid Cloud Code function", function: function)
    case .invalidBody:
      return cloudCodeMakeError(code: "INVALID_BODY", message: cloudCodeError.localizedDescription ?? "Invalid Cloud Code body")
    case .invalidHeader(let header):
      return cloudCodeMakeError(code: "INVALID_HEADER", message: cloudCodeError.localizedDescription ?? "Invalid Cloud Code header", header: header)
    case .networkUnavailable:
      return cloudCodeMakeError(code: "NETWORK_UNAVAILABLE", message: cloudCodeError.localizedDescription ?? "Network unavailable")
    case .timedOut:
      return cloudCodeMakeError(code: "TIMED_OUT", message: cloudCodeError.localizedDescription ?? "Cloud Code request timed out")
    case .invalidURL:
      return cloudCodeMakeError(code: "INVALID_URL", message: cloudCodeError.localizedDescription ?? "Invalid Cloud Code URL")
    case .transport(let detail):
      return cloudCodeMakeError(code: "TRANSPORT", message: detail)
    case .decoding(let detail):
      return cloudCodeMakeError(code: "DECODING", message: detail)
    case .http(let statusCode, let body, let rawBody, let requestId):
      return cloudCodeMakeError(
        code: "HTTP",
        message: cloudCodeError.localizedDescription ?? "Cloud Code returned HTTP \(statusCode)",
        statusCode: statusCode,
        body: body?.toAny(),
        rawBody: rawBody,
        requestId: requestId
      )
    }
  }

  private static func cloudCodeResponseDict(_ response: CloudCodeResponse) -> [String: Any] {
    return [
      "data": response.data,
      "statusCode": response.statusCode,
      "requestId": response.requestId as Any,
      "headers": response.headers,
    ]
  }

  @objc
  public static func cloudCodeCall(
    _ requestId: String,
    function: String,
    method: String,
    query: [String: Any],
    body: [String: Any],
    headers: [String: Any],
    completion: @escaping @Sendable (NSDictionary?, NSError?) -> Void
  ) {
    guard let httpMethod = cloudCodeHttpMethod(from: method) else {
      completion(nil, cloudCodeMakeError(code: "INVALID_METHOD", message: "Unsupported Cloud Code method: \(method)"))
      return
    }

    // `query`/`headers` are typed [String: Any] (not [String: String]) specifically so this
    // conversion — not an implicit NSDictionary bridge — is what decides what happens to a
    // non-string value: Swift's automatic NSDictionary -> [String: String] bridging traps
    // (fatal error) on a type mismatch instead of raising a catchable error. CloudCode.ts's
    // snapshotStringMap already rejects a non-string query/header value before the bridge is
    // ever called, so this is defense-in-depth against a caller that bypasses that JS-side
    // check — drop the entry instead of crashing the app, mirroring
    // AppambitCloudCodeModule.kt's readableMapToStringMap type guard on Android.
    let stringQuery = query.compactMapValues { $0 as? String }
    let stringHeaders = headers.compactMapValues { $0 as? String }

    // Registered *before* CloudCode.call(...) is invoked, not after. CloudCode.call delivers
    // every validation error (notInitialized, invalidFunction/-Header/-Body) via
    // DispatchQueue.main.async from inside the call itself, and this method has no declared
    // methodQueue (see AppAmbitCloudCode.mm), so it runs on the TurboModule's default queue
    // rather than main. If the main queue drained that block before this thread reached the
    // old post-call registration line, the completion closure below would find nothing in
    // `cloudCodePending`, treat it as an already-settled/cancelled request, and return without
    // ever invoking `completion` — the JS promise would hang forever. Registering first closes
    // that window: the entry always exists by the time any completion (sync or async) can look
    // it up. Matches Flutter's CloudCodeFlutter.swift, which registers its PendingRequest
    // before calling CloudCode.call for the same reason. `pending.token` is filled in
    // afterwards; a cancel/invalidate that races in before that assignment just finds
    // `token == nil` and skips the `cancel()` call — the entry is already gone from the map by
    // then, so the completion below still won't double-settle.
    let pending = CloudCodePendingRequest(completion: completion)
    cloudCodeLock.lock()
    cloudCodePending[requestId] = pending
    cloudCodeLock.unlock()

    let token = CloudCode.call(
      function,
      method: httpMethod,
      query: stringQuery.isEmpty ? nil : stringQuery,
      body: body.isEmpty ? nil : body,
      headers: stringHeaders.isEmpty ? nil : stringHeaders
    ) { response, error in
      cloudCodeLock.lock()
      let stillPending = cloudCodePending.removeValue(forKey: requestId) != nil
      cloudCodeLock.unlock()
      // Already removed by cloudCodeCancel/cloudCodeInvalidate — that path already delivered
      // CANCELLED to JS, so this natural completion must not deliver a second, conflicting
      // result. `stillPending` being the single atomic gate is what makes this safe under a
      // concurrent cancel: only whichever side wins the removeValue(forKey:) gets to settle.
      guard stillPending else { return }

      if let error = error {
        completion(nil, cloudCodeCanonicalError(from: error))
      } else if let response = response {
        completion(cloudCodeResponseDict(response) as NSDictionary, nil)
      } else {
        completion(nil, cloudCodeMakeError(code: "UNKNOWN", message: "Cloud Code returned no response"))
      }
    }

    cloudCodeLock.lock()
    // No-op if the completion above already won the race and removed this entry from the map.
    pending.token = token
    cloudCodeLock.unlock()
  }

  @objc
  public static func cloudCodeCancel(
    _ requestId: String,
    completion: @escaping @Sendable (NSError?) -> Void
  ) {
    cloudCodeLock.lock()
    let entry = cloudCodePending.removeValue(forKey: requestId)
    cloudCodeLock.unlock()

    // Idempotent: cancelling an unknown/already-settled requestId is a no-op, not an error.
    if let entry = entry {
      entry.token?.cancel()
      // Settle the *original* cloudCodeCall completion right now instead of leaving its
      // TurboModule promise (and the native closure capturing it) pending until the
      // underlying transport naturally completes or hits the ~60s Cloud Code timeout.
      // Matches AppambitCloudCodeModule.kt's cancel(), which rejects the original promise
      // synchronously via the same atomic remove-then-settle pattern.
      entry.completion(nil, cloudCodeMakeError(code: "CANCELLED", message: "Cloud Code request was cancelled"))
    }
    completion(nil)
  }

  // RCTInvalidating hook (see AppAmbitCloudCode.mm): cancels and settles every request still
  // pending when the bridge tears down, so no native completion closure — or the JS promise
  // it would have resolved — outlives the bridge instance that owns it. The only module in
  // this repo that needs this, because it's the only one with state between calls.
  @objc
  public static func cloudCodeInvalidate() {
    cloudCodeLock.lock()
    let entries = Array(cloudCodePending.values)
    cloudCodePending.removeAll()
    cloudCodeLock.unlock()

    for entry in entries {
      entry.token?.cancel()
      entry.completion(nil, cloudCodeMakeError(code: "CANCELLED", message: "Cloud Code request was cancelled"))
    }
  }

}
