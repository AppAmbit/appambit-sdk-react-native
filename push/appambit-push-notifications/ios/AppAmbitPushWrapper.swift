import Foundation
import UserNotifications
import AppAmbitPushNotifications

@objc(AppAmbitPushWrapper)
public class AppAmbitPushWrapper: NSObject {

  @objc public static func start() {
    PushNotifications.start()
  }

  @objc public static func handleNewToken(_ token: String) {
    PushKernel.handleNewToken(token)
  }

  @objc public static func setNotificationsEnabled(_ enabled: Bool) {
    PushNotifications.setNotificationsEnabled(enabled)
  }

  /// Completion-based variant: reports whether the backend network call succeeded.
  /// Used by the offline-retry path so it knows when to clear the pending flag.
  @objc(setNotificationsEnabled:completion:)
  public static func setNotificationsEnabled(_ enabled: Bool, completion: @escaping (Bool) -> Void) {
    PushNotifications.setNotificationsEnabled(enabled)
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
      completion(granted)
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
