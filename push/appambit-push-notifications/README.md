# AppAmbit Push Notifications SDK

**Seamlessly integrate push notifications with your AppAmbit analytics.**

This SDK is an extension of the core AppAmbit SDK, providing a simple and powerful way to handle Firebase Cloud Messaging (FCM) notifications on both Android and iOS.

---

## Contents

* [Features](#features)
* [Requirements](#requirements)
* [Install](#install)
* [Quickstart](#quickstart)
* [Usage](#usage)
* [Native Implementation Setup](#native-implementation-setup)
  * [Android Setup](#android-setup)
  * [iOS Setup](#ios-setup)
  * [iOS Notification Service Extension (Rich Notifications)](#ios-notification-service-extension-rich-notifications)

---

## Features

* **Simple Setup**: Integrates in minutes.
* **Enable/Disable Notifications**: Easily manage user preferences at both the business and FCM level.
* **Robust Event Listeners**: Separate callbacks for Foreground, Background (Android), and Opened (tapped) notifications.
* **Android Headless JS Support**: Handle background notifications using React Native Headless JS tasks even when the app is completely closed/killed.
* **Automatic Field Handling**: Automatically uses standard fields from the FCM payload like `color`, `icon`, `channel_id`, `click_action`, and rich images.
* **Rich Media & Extensions Support**: Full integration support for iOS Notification Service Extensions to handle rich payloads, badges, and media attachments.
* **Permission Helper**: Includes simple utilities to request the `POST_NOTIFICATIONS` permission with ease.

---

## Requirements

* **AppAmbit Core SDK**: This SDK is an extension and requires the core `appambit` SDK to be installed and configured.
* **Firebase Project**: A configured Firebase project with `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) in your application.
* **OS Versions**: Android API level 21 (Lollipop) or newer / iOS 13.0 or newer.

---

## Install

To install the library, run the following commands in your project directory:

```bash
npm install appambit
npm install appambit-push-notifications
```

### Android Dependencies

Add the following dependencies to your app's `build.gradle` file. Your app is still responsible for providing the Firebase Bill of Materials (BOM) and Firebase Messaging to ensure version compatibility.

**Kotlin DSL**

**`android/app/build.gradle.kts`**
```groovy
apply plugin: "com.google.gms.google-services"

dependencies {
    // The Firebase BOM and Messaging are required to align Firebase library versions.
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging:23.4.0")
}
```

**`android/build.gradle.kts`**
```groovy
dependencies {
    classpath("com.google.gms:google-services:4.3.15")
}
```

**Groovy**

**`android/app/build.gradle`**
```groovy
apply plugin: "com.google.gms.google-services"

dependencies {
    // The Firebase BOM and Messaging are required to align Firebase library versions.
    implementation platform('com.google.firebase:firebase-bom:33.1.2')
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
}
```

**`android/build.gradle`**
```groovy
dependencies {
    classpath("com.google.gms:google-services:4.3.15")
}
```

Ensure you have the Google Services plugin configured in your project.

### iOS Dependencies

After installing the npm package, run the pod installer:

```bash
cd ios && pod install
```

---

## Quickstart

1. **Import and Initialize the SDKs**: In your `App.tsx` (or application entry point), import and initialize both the core SDK and the Push Notifications SDK:

    ```javascript
    import * as AppAmbit from "appambit";
    import * as PushNotifications from "appambit-push-notifications";

    // Initialize core and push notifications
    AppAmbit.start("<YOUR-APPKEY>");
    PushNotifications.start();
    ```

2. **Request Permissions**: Request permissions to show push notifications:

    ```javascript
    PushNotifications.requestNotificationPermission();
    ```

---

## Usage

### Event Listeners

Register callbacks to handle push notifications depending on the app's state. All listeners return an unsubscribe function that you should call on cleanup (e.g. in `useEffect`'s return statement).

#### 1. Foreground Listener (All Platforms)
Fires when a notification is received while the app is active and open in the foreground.

```javascript
const unsubscribeForeground = PushNotifications.setForegroundListener((payload) => {
  console.log("Foreground notification received:", payload);
});
```

#### 2. Background Listener (Android Only)
Fires when a notification is received while the app is backgrounded.

```javascript
const unsubscribeBackground = PushNotifications.Android.setBackgroundListener((payload) => {
  console.log("Background notification received (Android):", payload);
});
```
*Note: To handle background and killed state notifications fully on Android, refer to the Android Headless JS registration section under Native Setup.*

#### 3. Opened Listener (All Platforms)
Fires when the user taps on the notification. This is supported regardless of the app's initial state (foreground, background, or killed).

```javascript
const unsubscribeOpened = PushNotifications.setOpenedListener((payload) => {
  console.log("Notification opened by user:", payload);
});
```

### Notification Payload Format

The notification payload has a standard, cross-platform format:

```typescript
export interface NotificationPayload {
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  data: Record<string, string>;
  android: {
    color: string | null;
    smallIconName: string | null;
  } | null;
  ios: {
    subtitle: string | null;
  } | null;
}
```

### Enabling and Disabling Notifications

Notifications are enabled by default. To opt users in or out (for example, in a settings screen), use `setNotificationsEnabled`:

```javascript
// Disable notifications
PushNotifications.setNotificationsEnabled(false);

// Enable notifications
PushNotifications.setNotificationsEnabled(true);
```

You can check if notifications are enabled asynchronously:

```javascript
const isEnabled = await PushNotifications.isNotificationsEnabled();
```

### Permission Helper with Result

To check if the user granted or denied the notification permission, use the helper with result:

```javascript
PushNotifications.requestNotificationPermissionWithResult().then((granted) => {
  if (granted) {
    console.log("Notification permission granted");
  } else {
    console.log("Notification permission denied");
  }
});
```

---

## Native Implementation Setup

To ensure events and background states are properly handled, the following native steps are required in your application codebases.

### Android Setup

The library includes pre-configured declarations in its `AndroidManifest.xml` which automatically merge into your app. These include permissions (`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`), the `AppAmbitInitProvider` (to initialize context Holder on boot/killed start), and `AppAmbitHeadlessService` (to handle background notifications via Headless JS).

To receive background notifications when the app is in a killed state, you **must** register a Headless JS task in your `index.js` file:

```javascript
import { AppRegistry, Platform } from 'react-native';
import * as PushNotifications from 'appambit-push-notifications';
import App from './src/App';
import { name as appName } from './app.json';

// Register Headless Task for Android background notifications
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask(
    PushNotifications.BACKGROUND_NOTIFICATION_TASK,
    () => async (payload) => {
      console.log('[AppAmbit] Headless task received background notification:', payload);
    }
  );
}

AppRegistry.registerComponent(appName, () => App);
```

---

### iOS Setup

To handle background and tap events on iOS, you need to update your native `AppDelegate`.

#### For Swift (`AppDelegate.swift`)

1. Adopt the `UNUserNotificationCenterDelegate` protocol.
2. In `application(_:didFinishLaunchingWithOptions:)`, set the delegate:
   ```swift
   UNUserNotificationCenter.current().delegate = self
   ```
3. Implement the delegate method `userNotificationCenter(_:didReceive:withCompletionHandler:)` to forward opened notifications.
4. Implement `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)` to handle background payloads.

Here is the complete configuration:

```swift
import UIKit
import React
import React_RCTAppDelegate
import AppAmbitSdkPushNotifications
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Set notification center delegate
    UNUserNotificationCenter.current().delegate = self
    
    // ... Rest of your React Native initialization code ...
    return true
  }

  // Handle opened notifications (tapped by user)
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    AppAmbitPushWrapper.didReceiveOpenedNotification(userInfo)
    completionHandler()
  }

  // Handle background remote notifications
  func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Forward the payload to trigger the background listener in React Native.
    AppAmbitPushWrapper.didReceiveBackgroundNotification(userInfo)
    
    // Request extra time from the OS to ensure React Native/AsyncStorage tasks complete
    var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    backgroundTask = application.beginBackgroundTask {
      application.endBackgroundTask(backgroundTask)
      backgroundTask = .invalid
    }
    
    // Give JS 5 seconds to process, then signal finish to OS
    DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
      completionHandler(.newData)
      if backgroundTask != .invalid {
        application.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
      }
    }
  }
}
```

#### For Objective-C++ (`AppDelegate.mm` / `AppDelegate.m`)

If your project uses Objective-C/Objective-C++ in `AppDelegate.mm`, apply the equivalent changes:

```objc
#import <UserNotifications/UserNotifications.h>
#import <AppAmbitSdkPushNotifications/AppAmbitSdkPushNotifications-Swift.h>

@interface AppDelegate () <UNUserNotificationCenterDelegate>
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  // Set notification center delegate
  [UNUserNotificationCenter currentNotificationCenter].delegate = self;

  // ... Rest of didFinishLaunchingWithOptions ...
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// Handle opened notifications
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
  NSDictionary *userInfo = response.notification.request.content.userInfo;
  [AppAmbitPushWrapper didReceiveOpenedNotification:userInfo];
  completionHandler();
}

// Handle background remote notifications
- (void)application:(UIApplication *)application
didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  [AppAmbitPushWrapper didReceiveBackgroundNotification:userInfo];
  
  __block UIBackgroundTaskIdentifier backgroundTask = [application beginBackgroundTaskWithExpirationHandler:^{
    [application endBackgroundTask:backgroundTask];
    backgroundTask = UIBackgroundTaskInvalid;
  }];
  
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    completionHandler(UIBackgroundFetchResultNewData);
    if (backgroundTask != UIBackgroundTaskInvalid) {
      [application endBackgroundTask:backgroundTask];
      backgroundTask = UIBackgroundTaskInvalid;
    }
  });
}
@end
```

---

### iOS Notification Service Extension (Rich Notifications)

To display rich push notifications (e.g. notifications with media attachments like images or dynamic subtitle updates), you should create a Notification Service Extension in your iOS application.

1. **Create the Extension in Xcode**:
   In Xcode, go to **File > New > Target** and select **Notification Service Extension**. Give it a name (e.g., `NotificationService`).

2. **Configure dependencies in `Podfile`**:
   Add the Extension dependency to your `Podfile` outside the main target definition:
   ```ruby
   target 'NotificationService' do
     pod 'AppAmbitPushNotificationsExtension', '~> 1.0.0'
   end
   ```
   Then run `pod install` under the `ios/` folder.

3. **Subclass `AppAmbitNotificationService`**:
   Replace the contents of the generated `NotificationService.swift` file in your extension target with:

   ```swift
   import UserNotifications
   import AppAmbitPushNotificationsExtension

   class NotificationService: AppAmbitNotificationService {
       override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
           // The base AppAmbitNotificationService automatically downloads and attaches rich media (images).
           // If you need custom notification mutations, do them here before calling super.
           super.didReceive(request, withContentHandler: contentHandler)
       }

       override func serviceExtensionTimeWillExpire() {
           super.serviceExtensionTimeWillExpire()
       }
   }
   ```