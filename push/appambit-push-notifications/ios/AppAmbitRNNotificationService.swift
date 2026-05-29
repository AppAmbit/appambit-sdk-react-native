import AppAmbitPushNotifications
import UserNotifications

/// RN-layer NSE base class. Subclass and override `appGroupIdentifier`
/// with the App Group shared between the main app and the NSE target.
open class AppAmbitRNNotificationService: AppAmbitNotificationService {

    open var appGroupIdentifier: String { "" }

    private static let storageKey = "com.appambit.pendingNotifications"
    private static let maxStored  = 50

    open override func handlePayload(_ notification: AppAmbitNotification,
                                     content: UNMutableNotificationContent) {
        guard !appGroupIdentifier.isEmpty,
              let defaults = UserDefaults(suiteName: appGroupIdentifier) else { return }
        let entry = buildEntry(notification)
        persist(entry, to: defaults)
    }

    private func buildEntry(_ notification: AppAmbitNotification) -> [String: Any] {
        var data: [String: Any] = [:]
        for (k, v) in notification.data {
            if let key = k as? String,
               JSONSerialization.isValidJSONObject([key: v]) {
                data[key] = v
            }
        }
        var entry: [String: Any] = [
            "receivedAt": ISO8601DateFormatter().string(from: Date()),
            "data": data,
        ]
        if let t = notification.title    { entry["title"]    = t }
        if let b = notification.body     { entry["body"]     = b }
        if let u = notification.imageUrl { entry["imageUrl"] = u }
        return entry
    }

    private func persist(_ entry: [String: Any], to defaults: UserDefaults) {
        var list = (defaults.array(forKey: Self.storageKey) as? [[String: Any]]) ?? []
        list.insert(entry, at: 0)
        if list.count > Self.maxStored { list = Array(list.prefix(Self.maxStored)) }
        defaults.set(list, forKey: Self.storageKey)
        defaults.synchronize()
    }
}
