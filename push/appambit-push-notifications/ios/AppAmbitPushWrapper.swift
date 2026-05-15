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
    var notificationData: [String: Any] = [:]
    var customData: [String: Any] = [:]

    if let aps = userInfo["aps"] as? [String: Any] {
      if let alert = aps["alert"] as? [String: Any] {
        notificationData["title"] = alert["title"]
        notificationData["body"] = alert["body"]
        notificationData["subtitle"] = alert["subtitle"]
      } else if let alertStr = aps["alert"] as? String {
        notificationData["body"] = alertStr
      }
      
      if let sound = aps["sound"] {
        notificationData["sound"] = sound
      }
      if let badge = aps["badge"] {
        notificationData["badge"] = badge
      }
    }

    for (key, value) in userInfo {
      let keyStr = (key as? String) ?? "\(key)"
      if keyStr == "aps" { continue }

      // If the payload has a nested "data" dictionary, we flatten it into customData
      if keyStr == "data", let nestedData = value as? [String: Any] {
        for (nestedKey, nestedValue) in nestedData {
          customData[nestedKey] = nestedValue
        }
      } else {
        customData[keyStr] = value
      }
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
