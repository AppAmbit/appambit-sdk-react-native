___

## Version 1.0.1

### AppAmbit

* **[Refactor]** Removed `clearCmsCache` and `clearAllCmsCache` APIs.Ccache management is now handled internally by the native SDK.

---

## Version 1.0.0

### AppAmbit Push Notifications SDK

* **[Breaking Change]** Removed `setNotificationCustomizerListener` — use `Android.setBackgroundListener` instead
* **[Breaking Change]** Android background notifications now require Headless JS (`AppAmbitHeadlessService`). Register `BACKGROUND_NOTIFICATION_TASK` in `index.js`
* **[Breaking Change]** `NotificationPayload` now has typed `android` and `ios` sub-objects instead of flat fields
* **[Feature]** Added `hasNotificationPermission()` for Android and iOS
* **[Feature]** Full iOS support: foreground and opened notifications (including app closed/killed state)
* **[Feature]** iOS Notification Service Extension (`AppAmbitRNNotificationService`) for rich media notifications
* **[Feature]** Expanded payload fields: `imageUrl`, `data` map, platform-specific `android`/`ios` metadata
* **[Fix]** Fixed opened notification on iOS when app is killed
* **[Fix]** Fixed offline notification queue on iOS
* **[Fix]** Notification custom data values serialized as strings to prevent bridge type errors
* **[Improvement]** Native SDKs migrated from local to remote dependencies on both platforms

---

## Version 0.3.1

### AppAmbit SDK

* **[Bugfix]** Fixed problem with `lib` folder and `js` files

## Version 0.3.0

### AppAmbit SDK

* **[Feature]** Added support for CMS (Content Management System) integration, allowing dynamic content updates and management within the app without requiring app updates. Using fluent API design for easy integration and configuration of CMS features.

## Version 0.2.0

### AppAmbit Push Notifications SDK

* **[Feature]** Added Push Notifications support for Android and iOS. This includes handling push notification permissions and receiving notifications.

### AppAmbit SDK

* **[Feature]** Added Remote Config support to AppAmbit, allowing dynamic configuration of app behavior without requiring app updates.
* **[Feature]** Added option to send breadcrumbs only on crashes to improve performance and resource efficiency.