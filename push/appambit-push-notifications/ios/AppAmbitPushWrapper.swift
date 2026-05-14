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
    var notificationData: [String: String] = [:]
    var customData: [String: String] = [:]

    if let aps = userInfo["aps"] as? [String: Any] {
      if let alert = aps["alert"] as? [String: Any] {
        notificationData["title"] = alert["title"] as? String
        notificationData["body"] = alert["body"] as? String
        notificationData["subtitle"] = alert["subtitle"] as? String
      } else if let alertStr = aps["alert"] as? String {
        notificationData["body"] = alertStr
      }
    }

    for (key, value) in userInfo {
      guard let keyStr = key as? String else { continue }
      if keyStr == "aps" { continue }
      customData[keyStr] = "\(value)"
    }

    var payload: [String: Any] = [
      "notification": notificationData
    ]

    if !customData.isEmpty {
      payload["data"] = customData
    }

    return payload
  }
}
