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

* **Zero-Config iOS**: No AppDelegate changes required — the SDK wires itself up automatically via method swizzling.
* **Simple Setup**: Integrates in minutes.
* **Enable/Disable Notifications**: Easily manage user preferences at both the business and FCM level.
* **Robust Event Listeners**: Separate callbacks for Foreground and Opened (tapped) notifications on both platforms, Background listener is Android-only.
* **Android Headless JS Support**: Handle background notifications via React Native Headless JS tasks even when the app is completely closed.
* **Automatic Field Handling**: Automatically uses standard FCM payload fields like `color`, `icon`, `channel_id`, `click_action`, and rich images.
* **Rich Media Support**: Full iOS Notification Service Extension support for rich payloads, badges, and media attachments.
* **Permission Helpers**: Utilities to request and check the `POST_NOTIFICATIONS` permission.

---

## Requirements

* **AppAmbit Core SDK**: Requires the core `appambit` SDK to be installed and configured.
* **Firebase Project**: A configured Firebase project with `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) in your application.
* **OS Versions**: Android API level 21 (Lollipop) or newer / iOS 13.0 or newer.

---

## Install

```bash
npm install appambit
npm install appambit-push-notifications
```

### Android Dependencies

Add the following to your Gradle files. Your app is responsible for providing the Firebase BOM and Firebase Messaging to ensure version compatibility.

**`android/app/build.gradle`** (Groovy)
```groovy
apply plugin: "com.google.gms.google-services"

dependencies {
    implementation platform('com.google.firebase:firebase-bom:33.1.2')
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
}
```

**`android/build.gradle`** (Groovy)
```groovy
dependencies {
    classpath("com.google.gms:google-services:4.3.15")
}
```

<details>
<summary>Kotlin DSL</summary>

**`android/app/build.gradle.kts`**
```kotlin
apply(plugin = "com.google.gms.google-services")

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging:23.4.0")
}
```

**`android/build.gradle.kts`**
```kotlin
dependencies {
    classpath("com.google.gms:google-services:4.3.15")
}
```
</details>

### iOS Dependencies

After installing the npm package, run:

```bash
cd ios && pod install
```

---

## Quickstart

In your `App.tsx` (or application entry point), initialize both SDKs in order:

```javascript
import * as AppAmbit from "appambit";
import * as PushNotifications from "appambit-push-notifications";

AppAmbit.start("<YOUR-APPKEY>");
PushNotifications.start();
PushNotifications.requestNotificationPermission();
```

---

## Usage

### Event Listeners

All listeners hold a single subscription — calling them again silently replaces the previous one. Each returns a cleanup function to call on unmount (e.g. in `useEffect`'s return).

#### Foreground Listener
Fires when a notification arrives while the app is active and open.

```javascript
useEffect(() => {
  const unsubscribe = PushNotifications.setForegroundListener((payload) => {
    console.log("Foreground notification:", payload);
  });
  return () => unsubscribe();
}, []);
```

#### Background Listener
Fires when a notification arrives while the app is backgrounded or (on Android) killed.

> **Android only**: To handle notifications when the app is completely killed, you must also register a Headless JS task — see [Android Setup](#android-setup).

```javascript
useEffect(() => {
  const unsubscribe = PushNotifications.Android.setBackgroundListener(async (payload) => {
    console.log("Background notification:", payload);
    // The SDK automatically signals the OS when your Promise resolves
  });
  return () => unsubscribe();
}, []);
```

#### Opened Listener
Fires when the user taps a notification. Works regardless of whether the app was in the foreground, background, or killed.

```javascript
useEffect(() => {
  const unsubscribe = PushNotifications.setOpenedListener((payload) => {
    console.log("Notification tapped:", payload);
  });
  return () => unsubscribe();
}, []);
```

### Notification Payload

```typescript
interface NotificationPayload {
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  data: Record<string, string>;
  android: {
    color: string | null;
    smallIconName: string | null;
    ticker: string | null;
    sticky: boolean | null;
    visibility: string | null;
    channelId: string | null;
    tag: string | null;
    sound: string | null;
    clickAction: string | null;
  } | null;
  ios: {
    badge: number | null;
    sound: string | null;
    category: string | null;
    threadId: string | null;
  } | null;
}
```

### Permission Helpers

```javascript
// Fire-and-forget — shows the system permission dialog
PushNotifications.requestNotificationPermission();

// Returns Promise<boolean> with the user's decision
const granted = await PushNotifications.requestNotificationPermissionWithResult();

// Check current permission status without prompting the user
const hasPermission = await PushNotifications.hasNotificationPermission();
```

### Enable / Disable Notifications

```javascript
PushNotifications.setNotificationsEnabled(false);  // opt out
PushNotifications.setNotificationsEnabled(true);   // opt back in

const isEnabled = await PushNotifications.isNotificationsEnabled();
```

---

## Native Implementation Setup

### Android Setup

The SDK's `AndroidManifest.xml` automatically merges the required permissions (`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`), `AppAmbitInitProvider`, and `AppAmbitHeadlessService` into your app — no manifest changes needed.

To handle notifications when the app is completely killed, register a Headless JS task in your `index.js`:

```javascript
import { AppRegistry, Platform } from 'react-native';
import * as PushNotifications from 'appambit-push-notifications';
import App from './src/App';
import { name as appName } from './app.json';

if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask(
    PushNotifications.BACKGROUND_NOTIFICATION_TASK,
    () => async (payload) => {
      console.log('Background notification (killed state):', payload);
    }
  );
}

AppRegistry.registerComponent(appName, () => App);
```

> Use `AppRegistry.registerHeadlessTask` with `BACKGROUND_NOTIFICATION_TASK` — not `BackgroundFetch` or any other API.

---

### iOS Setup

#### Push Notifications Capability & APNs Entitlement

Enable **Push Notifications** in Xcode under your target's *Signing & Capabilities* tab. This automatically injects the `aps-environment` entitlement into your `.entitlements` file.

If you manage `Runner.entitlements` manually (e.g. via version control or CI), make sure this key is present — without it APNs will reject device registration and no token will ever be delivered:

```xml
<!-- ios/Runner/Runner.entitlements -->
<key>aps-environment</key>
<string>development</string>   <!-- use "production" for App Store builds -->
```

---

### iOS Notification Service Extension (Rich Notifications)

To display rich notifications with image attachments, create a Notification Service Extension in Xcode.

1. **Create the extension**: Go to **File > New > Target**, select **Notification Service Extension**, and give it a name (e.g. `NotificationService`).

2. **Add the pod** to your `Podfile` outside the main target:
   ```ruby
   target 'NotificationService' do
     pod 'AppAmbitPushNotificationsExtension', '~> 1.0.0'
   end
   ```
   Then run `pod install` under `ios/`.

3. **Subclass `AppAmbitNotificationService`** in `NotificationService.swift`:

   ```swift
   import UserNotifications
   import AppAmbitPushNotificationsExtension

   class NotificationService: AppAmbitNotificationService {
     override func didReceive(
       _ request: UNNotificationRequest,
       withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
     ) {
       // Base class handles rich media download and attachment automatically.
       super.didReceive(request, withContentHandler: contentHandler)
     }

     override func serviceExtensionTimeWillExpire() {
       super.serviceExtensionTimeWillExpire()
     }
   }
   ```
