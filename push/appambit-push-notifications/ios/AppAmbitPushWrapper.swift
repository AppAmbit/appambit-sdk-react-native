import Foundation
import UserNotifications
import AppAmbitPushNotifications

@objc(AppAmbitPushWrapper)
public class AppAmbitPushWrapper: NSObject {

  @objc public static func start() {
    PushNotifications.start()
  }

  @objc public static func setNotificationsEnabled(_ enabled: Bool) {
    PushNotifications.setNotificationsEnabled(enabled)
  }

  @objc public static func isNotificationsEnabled() -> Bool {
    return PushNotifications.isNotificationsEnabled()
  }

  @objc public static func requestNotificationPermission(listener: ((Bool) -> Void)?) {
    PushNotifications.requestNotificationPermission(listener: listener)
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

    // ── Parse APNs envelope ────────────────────────────────────────────────
    if let aps = userInfo["aps"] as? [String: Any] {
      if let alert = aps["alert"] as? [String: Any] {
        title    = alert["title"] as? String
        body     = alert["body"] as? String
        subtitle = alert["subtitle"] as? String
      } else if let alertStr = aps["alert"] as? String {
        body = alertStr
      }
    }

    // ── Parse custom keys (skip "aps") ─────────────────────────────────────
    for (key, value) in userInfo {
      let keyStr = (key as? String) ?? "\(key)"
      if keyStr == "aps" { continue }

      if keyStr == "image_url" || keyStr == "imageUrl" {
        imageUrl = value as? String
      } else if keyStr == "data", let nestedData = value as? [String: Any] {
        // Flatten a nested "data" dictionary into customData
        for (nestedKey, nestedValue) in nestedData {
          customData[nestedKey] = nestedValue
        }
      } else {
        customData[keyStr] = value
      }
    }

    // ── Build payload matching PushNotificationData ────────────────────────
    // {
    //   title:    string | null,
    //   body:     string | null,
    //   imageUrl: string | null,
    //   data:     { [key: string]: string },
    //   android:  null,
    //   ios: { subtitle: string | null }
    // }
    var payload: [String: Any] = [
      "title":    title as Any,
      "body":     body as Any,
      "imageUrl": imageUrl as Any,
      "data":     customData,
      "android":  NSNull(),
      "ios":      ["subtitle": subtitle as Any],
    ]

    return payload
  }
}
