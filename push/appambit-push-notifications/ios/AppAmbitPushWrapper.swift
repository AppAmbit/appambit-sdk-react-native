import Foundation
import UserNotifications
import Network
import AppAmbitPushNotifications
import AppAmbit

@objc(AppAmbitPushWrapper)
public class AppAmbitPushWrapper: NSObject {

  // MARK: - Network monitoring
  //
  // The AppAmbit SDK's ConsumerService has no offline retry queue and dedups
  // consumer updates against its local DB, so an update attempted while offline
  // poisons that cache and is never re-sent. We therefore gate consumer updates
  // on real connectivity and replay them when the network returns.
  private static let pathMonitor = NWPathMonitor()
  private static let monitorQueue = DispatchQueue(label: "com.appambit.push.netmonitor")
  private static var monitorStarted = false
  private static var lastSatisfied = false

  @objc public static func startNetworkMonitor() {
    if monitorStarted { return }
    monitorStarted = true
    pathMonitor.pathUpdateHandler = { path in
      let satisfied = path.status == .satisfied
      let becameAvailable = satisfied && !lastSatisfied
      lastSatisfied = satisfied
      if becameAvailable {
        NotificationCenter.default.post(
          name: NSNotification.Name("AppAmbit_networkAvailable"),
          object: nil
        )
      }
    }
    pathMonitor.start(queue: monitorQueue)
  }

  @objc public static func isNetworkAvailable() -> Bool {
    if !monitorStarted { startNetworkMonitor() }
    return pathMonitor.currentPath.status == .satisfied
  }

  @objc public static func start() {
    startNetworkMonitor()
    // In Debug builds enable the SDK's verbose logging so its native logs are
    // visible in the simulator/device log stream during development.
    #if DEBUG
    PushNotifications.start(debugMode: true)
    #else
    PushNotifications.start()
    #endif
  }

  @objc public static func setNotificationsEnabled(_ enabled: Bool) {
    PushNotifications.setNotificationsEnabled(enabled)
  }

  /// Persists the enabled flag locally (UserDefaults only — no network call).
  /// Used so the SDK's cold-start token sync knows the user's intent without
  /// triggering an offline-poisoning consumer update.
  @objc public static func setNotificationsEnabledLocal(_ enabled: Bool) {
    PushKernel.setNotificationsEnabled(enabled)
  }

  /// Completion-based variant: reports whether the backend network call succeeded.
  /// Used by the offline-retry path so it knows when to clear the pending flag.
  @objc(setNotificationsEnabled:completion:)
  public static func setNotificationsEnabled(_ enabled: Bool, completion: @escaping (Bool) -> Void) {
    PushKernel.setNotificationsEnabled(enabled)
    let token = PushKernel.getCurrentToken()
    ConsumerService.shared.updateConsumer(deviceToken: token, pushEnabled: enabled, completion: completion)
  }

  @objc public static func isNotificationsEnabled() -> Bool {
    return PushNotifications.isNotificationsEnabled()
  }

  @objc public static func requestNotificationPermission(listener: ((Bool) -> Void)?) {
    PushNotifications.requestNotificationPermission(listener: listener)
  }

  @objc public static func hasNotificationPermission(completion: @escaping (Bool) -> Void) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      let granted = settings.authorizationStatus == .authorized
        || settings.authorizationStatus == .provisional
      if granted {
        // Cache the grant so we can survive simulator reinstalls where the
        // system returns .notDetermined even though permission was given before.
        UserDefaults.standard.set(true, forKey: "appambit_push_has_permission")
      }
      // If the system says .denied, the user explicitly revoked — always return false.
      // If the system says .notDetermined AND we have a cached grant, the app was
      // likely reinstalled (common on iOS Simulator) — return true as fallback.
      let fallback = settings.authorizationStatus == .notDetermined
        && UserDefaults.standard.bool(forKey: "appambit_push_has_permission")
      completion(granted || fallback)
    }
  }

  @objc(setNotificationListener:)
  public static func setNotificationListener(listener: @escaping ((NSDictionary, Int) -> Void)) {
    PushNotifications.setNotificationListener { userInfo, state in
      let payload = formatNotificationPayload(userInfo)
      listener(payload as NSDictionary, state.rawValue)
    }
  }

  public static var pendingBackgroundPayloads: [[String: Any]] = []

  public static var pendingOpenedPayloads: [[String: Any]] = []

  @objc(didReceiveBackgroundNotification:)
  public static func didReceiveBackgroundNotification(_ userInfo: [AnyHashable: Any]) {
    let payload = formatNotificationPayload(userInfo)
    pendingBackgroundPayloads.append(payload)

    NotificationCenter.default.post(
      name: NSNotification.Name("AppAmbit_onBackgroundNotification"),
      object: nil,
      userInfo: payload
    )
  }

  @objc(didReceiveOpenedNotification:)
  public static func didReceiveOpenedNotification(_ userInfo: [AnyHashable: Any]) {
    let payload = formatNotificationPayload(userInfo)
    pendingOpenedPayloads.append(payload)

    NotificationCenter.default.post(
      name: NSNotification.Name("AppAmbit_onOpenedNotification"),
      object: nil,
      userInfo: payload
    )
  }
  
  @objc public static func getAndClearPendingBackgroundPayloads() -> [[String: Any]] {
    let payloads = pendingBackgroundPayloads
    pendingBackgroundPayloads.removeAll()
    return payloads
  }

  @objc public static func getAndClearPendingOpenedPayloads() -> [[String: Any]] {
    let payloads = pendingOpenedPayloads
    pendingOpenedPayloads.removeAll()
    return payloads
  }

  @objc(formatNotificationPayload:)
  public static func formatNotificationPayload(_ userInfo: [AnyHashable: Any]) -> [String: Any] {
    var title: String? = nil
    var body: String? = nil
    var subtitle: String? = nil
    var imageUrl: String? = nil
    var customData: [String: Any] = [:]

    let aps = userInfo["aps"] as? [String: Any]
    if let aps = aps {
      if let alert = aps["alert"] as? [String: Any] {
        title    = alert["title"] as? String
        body     = alert["body"] as? String
        subtitle = alert["subtitle"] as? String
      } else if let alertStr = aps["alert"] as? String {
        body = alertStr
      }
    }

    let imageUrlKeys: Set<String> = ["image_url", "imageUrl", "image"]
    for (key, value) in userInfo {
      let keyStr = (key as? String) ?? "\(key)"
      if keyStr == "aps" { continue }

      if imageUrlKeys.contains(keyStr) {
        if imageUrl == nil { imageUrl = value as? String }
      } else if keyStr == "data", let nestedData = value as? [String: Any] {
        for (nestedKey, nestedValue) in nestedData {
          customData[nestedKey] = (nestedValue as? String) ?? String(describing: nestedValue)
        }
      } else {
        customData[keyStr] = (value as? String) ?? String(describing: value)
      }
    }

    var iosMap: [String: Any] = ["subtitle": subtitle as Any]
    if let badge = aps?["badge"] as? Int       { iosMap["badge"]    = badge }
    if let sound = aps?["sound"] as? String    { iosMap["sound"]    = sound }
    if let cat   = aps?["category"] as? String { iosMap["category"] = cat }
    if let tid   = aps?["thread-id"] as? String { iosMap["threadId"] = tid }

    var payload: [String: Any] = [
      "title":    title as Any,
      "body":     body as Any,
      "imageUrl": imageUrl as Any,
      "data":     customData,
      "android":  NSNull(),
      "ios":      iosMap,
    ]

    return payload
  }
}
