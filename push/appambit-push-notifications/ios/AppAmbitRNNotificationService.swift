import Foundation
import UserNotifications
import AppAmbitPushNotifications

/// A React Native wrapper for the AppAmbit Notification Service Extension.
/// Subclass this in your iOS Notification Service Extension target to automatically
/// process rich media and custom payloads from AppAmbit.
@objc(AppAmbitRNNotificationService)
open class AppAmbitRNNotificationService: AppAmbitNotificationService {
    
    open override func handlePayload(_ notification: AppAmbitNotification, content: UNMutableNotificationContent) {
        super.handlePayload(notification, content: content)
        
        // The base AppAmbitNotificationService automatically handles rich media attachments (images).
        // If you need to mutate the notification content further before it is displayed,
        // you can do so here.
    }
}
