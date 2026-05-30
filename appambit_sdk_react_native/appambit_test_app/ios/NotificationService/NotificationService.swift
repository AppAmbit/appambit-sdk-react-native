import UserNotifications
import AppAmbitPushNotificationsExtension

class NotificationService: AppAmbitNotificationService {

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    guard let bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent else {
      contentHandler(request.content)
      return
    }

    let userInfo = bestAttemptContent.userInfo
    let aps = userInfo["aps"] as? [String: Any]
    
    bestAttemptContent.title += " Custom"

    if let category = aps?["category"] as? String {
      bestAttemptContent.categoryIdentifier = category
    }
    if let threadId = aps?["thread-id"] as? String {
      bestAttemptContent.threadIdentifier = threadId
    }

    // Custom data fields sent in FCM data payload
    let data = userInfo["data"] as? [String: Any]
    if let badgeCount = data?["badge_count"] as? String,
       let badge = Int(badgeCount) {
      bestAttemptContent.badge = NSNumber(value: badge)
    }
    if #available(iOS 15.0, *) {
      if let isUrgent = data?["is_urgent"] as? String, isUrgent == "true" {
        bestAttemptContent.interruptionLevel = .timeSensitive
      }
    }

    let newRequest = UNNotificationRequest(
      identifier: request.identifier,
      content: bestAttemptContent,
      trigger: request.trigger
    )
    // Base class downloads the image from "image" key and attaches it
    super.didReceive(newRequest, withContentHandler: contentHandler)
  }

  override func serviceExtensionTimeWillExpire() {
    super.serviceExtensionTimeWillExpire()
  }
}
