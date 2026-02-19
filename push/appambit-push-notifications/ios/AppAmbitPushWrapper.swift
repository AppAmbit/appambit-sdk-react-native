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

  @objc(setNotificationCustomizer:)
  public static func setNotificationCustomizer(listener: ((NSDictionary) -> Void)?) {
    PushNotifications.setNotificationCustomizer { notification in
      let content = notification.request.content
      let userInfo = content.userInfo

      var notificationData: [String: String] = [
        "title": content.title,
        "body": content.body
      ]

      if !content.subtitle.isEmpty {
        notificationData["subtitle"] = content.subtitle
      }

      var customData: [String: String] = [:]
      for (key, value) in userInfo {
        guard let keyStr = key as? String else { continue }
        if keyStr == "aps" || keyStr == "appambit" { continue }
        customData[keyStr] = "\(value)"
      }

      var payload: [String: Any] = [
        "notification": notificationData
      ]

      if !customData.isEmpty {
        payload["data"] = customData
      }

      listener?(payload as NSDictionary)
    }
  }
}
