<picture>
  <source media="(prefers-color-scheme: light)" srcset="https://assets.appambit.com/logo-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://assets.appambit.com/logo-dark.svg">
  <img alt="AppAmbit logo" src="https://assets.appambit.com/logo-dark.svg" width="280">
</picture>

# AppAmbit React Native SDK

**The App Command Center.**
Everything your app needs after you build it, in one connected platform instead of stitching together separate tools.

[![Discord](https://img.shields.io/discord/1418426396836888617?label=Discord&logo=discord&color=5865F2)](https://discord.gg/nJyetYue2s)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/appambit.svg)](https://www.npmjs.com/package/appambit)
[![platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-brightgreen.svg)](https://www.npmjs.com/package/appambit)

---

## Quick start

1. Sign up free at [appambit.com](https://appambit.com), no credit card required
2. Create an app in the dashboard and grab your app key
3. Install the SDK ([see below](#install))
4. Initialize it at app launch:

**TypeScript / JavaScript**

```tsx
import { useEffect } from 'react';
import { start } from 'appambit';

export default function App() {
  useEffect(() => {
    start('<YOUR-APPKEY>');
  }, []);

  return <MyApp />;
}
```

That's it. Crashes, sessions, and analytics start flowing immediately. Importing the package also installs a global error handler, so uncaught JS errors are reported without any extra wiring. Full setup guides live in the [docs](https://docs.appambit.com).

---

## What's inside

### 🚀 Ship
- **Build delivery**: push a build from GitHub, Bitbucket, Azure DevOps, or manually, then send it to team, testers, or clients by email or direct install, and track who installed it
- **Live updates**: ship changes without waiting on an app store review

### 📊 Monitor
- **Crash & error monitoring**: uncaught native crashes and unhandled JS errors are captured with stack traces, then uploaded on the next launch, grouped with who's affected and email alerts on new issues
- **Error logging**: structured log messages with custom properties for quick diagnostics, sent even when the app does not crash
- **Session timeline & breadcrumbs**: navigation trail so you see exactly what led to a crash
- **Analytics & event tracking**: automatic session starts, stops, and durations plus structured events with custom properties, live and compared across versions

### 📈 Grow
- **Push notifications**: APNs and FCM through the optional `appambit-push-notifications` package, targeted by segment and scheduled from the dashboard
- **Remote config & feature flags**: typed keys (`getString`, `getBoolean`, `getLong`, `getDouble`) with version targeting, so you can flip features, run gradual rollouts, or hit the kill switch without a release
- **CMS**: define content types and entries in the dashboard, then read articles, FAQs, and promos with a fluent query builder that supports filters, full-text search, sorting, and pagination

### 🗄️ Backend
- **App database**: a managed SQL database with a fluent query builder, batches, and transactions, straight from the SDK or the dashboard
- **Cloud code**: deploy JavaScript functions triggered by HTTP, data events, or manually, then invoke them from the app with typed results, cancellation, and request correlation. Every deploy is a version, so rollback is one click
- **AI agent (MCP)**: build your backend from a conversation with Claude or Cursor ([more below](#built-for-agentic-coding))

### 👥 Teams
- Workspaces, squads, roles and access, per-app reporting

---

## Built for agentic coding

Point Claude or Cursor at the AppAmbit MCP server and it can provision your entire backend from a conversation (content types, database schema, and cloud code functions) while writing the app code that calls them. Paired with a [sample app](#sample-apps) or a [starter app](#starter-apps), that means going from a prompt to a working app with a live backend in a single sitting.

Set it up from the AppAmbit dashboard under **Settings → AI Assistant**, where you create the personal access token and get the connection details for your assistant.

---

## Requirements

* Node 20 or newer
* Yarn 3.6.1 or newer
* **Android**: Android 5.0 (API 21) or newer, `compileSdk` 35, `targetSdk` 34
* **iOS**: Xcode 15 or newer on macOS 13 or newer

The package is a thin TurboModule bridge over the native AppAmbit SDKs, so it needs a React Native version with the New Architecture available.

---

## Getting started

- [Install](#install)
  - [npm](#npm)
  - [Android permissions](#android-permissions)
  - [Push setup](#choose-a-push-setup)
- [Track events](#track-events)
- [Logs](#logs)
- [Breadcrumbs](#breadcrumbs)
- [Remote config](#remote-config)
- [Release distribution](#release-distribution)
- [CMS](#cms)
- [Database](#database)
- [Cloud code](#cloud-code)

### Install

#### npm

> Requires **v1.2.0 or newer**. Earlier versions do not include Cloud Code support.

```bash
npm install appambit
# or
yarn add appambit
```

Then install pods for iOS:

```bash
cd ios && pod install
```

| Package | Add when | Import |
|---|---|---|
| `appambit` | Always | `import { start, trackEvent, db, cms, CloudCode } from 'appambit'` |
| `appambit-push-notifications` | *(optional, only if you use push)* | `import * as Push from 'appambit-push-notifications'` |

> The npm version and the underlying native SDK versions are separate release lines and are not meant to converge. Bump each against its own upstream release rather than aligning the numbers.

#### Android permissions

Add these to your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
```

#### Choose a push setup

Push notifications are delivered over FCM (Android) and APNs (iOS) and ship as a separate package:

```bash
npm install appambit-push-notifications
```

Start it after the core SDK:

```tsx
import { start } from 'appambit';
import * as Push from 'appambit-push-notifications';

start('<YOUR-APPKEY>');
Push.start();
Push.requestNotificationPermission();

Push.setForegroundListener((notification) => {
  console.log('Foreground:', notification);
});
Push.setOpenedListener((notification) => {
  console.log('Opened:', notification);
});
```

Also available: `requestNotificationPermissionWithResult`, `setNotificationsEnabled`, `isNotificationsEnabled`, and `hasNotificationPermission`.

iOS needs no AppDelegate changes: the SDK wires itself up via swizzling. Android needs a `google-services.json` and the Google Services Gradle plugin. Background delivery with the app fully closed uses Headless JS through `Push.Android.setBackgroundListener` and is **Android-only**; foreground and opened listeners work on both platforms.

For rich iOS notifications, the podspec exposes an `Extension` subspec you add to your Notification Service Extension target. See the [Push Notifications guide](push/appambit-push-notifications/README.md) for the complete setup.

---

### Usage

Everything below works once `start(appKey)` has run. Session activity (starts, stops, and durations) is tracked automatically, and uncaught crashes are captured and uploaded on the next launch with no extra code.

Note the split conventions the native bridge enforces: **remote config getters return synchronously**, while CMS, database, crash, and Cloud Code methods are asynchronous.

### Track events

Send structured events with custom properties.

```tsx
import { trackEvent } from 'appambit';

trackEvent('ButtonClicked', { Count: '41' });
```

Also available: `setUserId`, `setUserEmail`, `startSession`, `endSession`, and `enableManualSession` if you want to drive sessions yourself.

---

### Logs

Add structured log messages for debugging, sent even when the app does not crash.

```tsx
import { logError, logErrorMessage } from 'appambit';

try {
  throw new Error('Something went wrong');
} catch (e: any) {
  await logError({
    exception: e,
    stack: e.stack,
    classFqn: e.constructor.name,
    properties: { user_id: '1' },
  });
}

// Or just a message
logErrorMessage('This code should not be reached', { user_id: '1' });
```

`logError` also accepts `message`, `fileName`, and `lineNumber` if you want to override the inferred call site. `didCrashInLastSession()` resolves to whether the previous run ended in a crash.

---

### Breadcrumbs

Register the navigation tracker with your React Navigation container ref to record screen changes automatically:

```tsx
import { useNavigationContainerRef } from '@react-navigation/native';
import { registerNavigationTracking } from 'appambit';

const navigationRef = useNavigationContainerRef();

useEffect(() => registerNavigationTracking(navigationRef), [navigationRef]);
```

> `registerNavigationTracking` is **Android-only** today. On iOS it returns a no-op unsubscribe, so the call is safe to leave in shared code.

On either platform you can record a breadcrumb yourself:

```tsx
import { addBreadcrumb } from 'appambit';

addBreadcrumb('Checkout started');
```

---

### Remote config

Fetch and apply remote configuration values using type-safe getters. Unlike the other subsystems, **these getters are synchronous**.

```tsx
import { enableConfig, getString, getBoolean, getLong, getDouble } from 'appambit';

// Enable remote config
enableConfig();

// Get remote config values with type-safe methods
const message = getString('data');
const isFeatureEnabled = getBoolean('banner');
const discount = getLong('discount');
const maxUpload = getDouble('max_upload');
```

---

### Release distribution

Ship a build to your team, testers, or clients without waiting on a store review. Connect GitHub, Bitbucket, or Azure DevOps so every pipeline run uploads its artifact. Send it out by email or a direct install link, and see who actually installed it.

This repo ships a pipeline for each one that builds and signs the app, ready to copy into your own:

| CI | Pipeline |
| --- | --- |
| GitHub Actions (Android) | [.github/workflows/build-apk.yml](.github/workflows/build-apk.yml) |
| GitHub Actions (iOS) | [.github/workflows/build-ipa.yml](.github/workflows/build-ipa.yml) |
| Bitbucket Pipelines | [bitbucket-pipelines.yml](bitbucket-pipelines.yml) |
| Azure DevOps (Android) | [azure-devops-pipelines-android.yml](azure-devops-pipelines-android.yml) |
| Azure DevOps (iOS) | [azure-devops-pipelines-ios.yml](azure-devops-pipelines-ios.yml) |

---

### CMS

Read content you publish from the dashboard (articles, FAQs, promos) without shipping a new build.

```tsx
import { cms } from 'appambit';

const posts = await cms()
  .content('blog_extended')
  .equals('is_published', 'true')
  .orderByDescending('views_count')
  .getPerPage(20)
  .getList();
```

Also available: `search`, `notEquals`, `contains`, `startsWith`, `greaterThan(OrEqual)`, `lessThan(OrEqual)`, `inList`, `notInList`, `orderByAscending`, `getPage`.

---

### Database

Query, insert, update, and delete rows in your AppAmbit database with a fluent builder.

```tsx
import { db } from 'appambit';

// Query rows
const notes = await db()
  .from('notes')
  .where('done', 0)
  .orderByDesc('title')
  .limit(10)
  .get();

// Insert a row
await db().from('notes').insert({ title: 'Hello', done: 0 });

// Update requires at least one where()
await db().from('notes').where('id', 1).update({ done: 1 });
```

Also available: `select`, the three-argument `where(column, op, value)` form, `whereIn`, `orderBy`, `offset`, `first`, `count`, `delete`, plus raw SQL through `db().execute`, `db().batch`, and `db().batchInTransaction`.

---

### Cloud code

Invoke authenticated HTTP functions hosted by AppAmbit. Cloud Code uses the same consumer and Bearer token as the rest of the SDK, so no extra setup is needed beyond `start(appKey)`. Configure an active Cloud Function with an enabled HTTP trigger and slug in the dashboard, then call it. Calls are request/response only and are not queued for offline upload.

```tsx
import { CloudCode, CloudCodeError } from 'appambit';

try {
  const response = await CloudCode.call('hello', {
    method: 'POST',
    body: { name: 'Ada' },
  });
  console.log(`HTTP ${response.statusCode}:`, response.data);
} catch (e) {
  if (e instanceof CloudCodeError) {
    console.log(e.code, e.message, e.requestId);
  }
}
```

`method` defaults to `POST`. The options object also accepts `query`, `headers`, and an optional client-side `timeout` in milliseconds. A successful call resolves to `{ data, statusCode, requestId, headers }`.

**Typed responses.** Pass a `fromJson` mapper to decode the body into your own type:

```tsx
type Greeting = { greeting: string };

const result = await CloudCode.callTyped<Greeting>('hello', {
  method: 'GET',
  fromJson: (value) => value as Greeting,
});

console.log(result.data?.greeting);
```

A mapper that throws surfaces as a `Decoding` error rather than an unhandled exception, and an empty successful body produces `null` typed data.

**Cancellation.** `call` and `callTyped` return a `CloudCodeRequest`, which is awaitable but is not a `Promise`: it also carries a `requestId` and a `cancel()` method.

```tsx
const request = CloudCode.call('slow-report');
request.cancel(); // rejects with CloudCodeErrorCode.Cancelled
```

Cancellation settles immediately in JS without waiting for the native round trip, and pending requests are cancelled automatically when the bridge is torn down on a JS reload.

**Errors.** Every failure is a `CloudCodeError` with a `code` from `CloudCodeErrorCode` (`Http`, `TimedOut`, `NetworkUnavailable`, `Cancelled`, `Decoding`, `InvalidFunction`, `InvalidHeader`, and more), plus `statusCode`, `headers`, `body`/`rawBody`, and `requestId` where the platform provides them. Reserved headers are rejected before the request leaves the device. The optional JS `timeout` is a client-side deadline layered on top of the native 60-second timeout, not a replacement for it.

Runnable examples of the backend functions live in [`CloudCodeExamplesAndroid.js`](appambit_sdk_react_native/appambit_test_app/CloudCode/CloudCodeExamplesAndroid.js) and [`CloudCodeExamplesiOS.js`](appambit_sdk_react_native/appambit_test_app/CloudCode/CloudCodeExamplesiOS.js).

See the [Cloud Code mobile guide](https://docs.appambit.com/sdk-guides/cloud-code/) for function setup, HTTP triggers, typed and dynamic responses, errors, request IDs, cancellation, timeouts, and backend examples.

---

## Sample apps

This repo ships a manual-test app that exercises every public feature, one screen per capability:

| App | Path |
| --- | --- |
| `appambit_test_app` | [appambit_sdk_react_native/appambit_test_app](appambit_sdk_react_native/appambit_test_app) |
| Push notifications example | [push/appambit-push-notifications/example](push/appambit-push-notifications/example) |

Replace `<YOUR-APPKEY>` with a real app key before running them, and drop in your own `google-services.json` if you want push on Android. The Cloud Code screen is backed by the deployable handlers in [appambit_test_app/CloudCode](appambit_sdk_react_native/appambit_test_app/CloudCode).

The two packages are separate Yarn workspace roots with no top-level workspace tying them together, so `cd` into a package before running any yarn command. From the repo root, [`setup.sh`](setup.sh) cleans, installs, and builds core, push, and the test app in order. To run the app:

```bash
cd appambit_sdk_react_native/appambit_test_app
./run-app.sh ios       # or: ./run-app.sh android
```

---

## Starter apps

Skip the blank-project setup. Clone a starter with AppAmbit already wired in: auth, push notifications, analytics, and a CMS-driven feed that needs no rebuild to change content. Each one ships with ready-made content sets you can import directly into your AppAmbit dashboard, then customize to make the app your own.

| Starter | Repo |
| --- | --- |
| React Native | [organization-app-starter-react-native](https://github.com/AppAmbit/organization-app-starter-react-native) |
| Flutter | [organization-app-starter-flutter](https://github.com/AppAmbit/organization-app-starter-flutter) |
| .NET MAUI | [organization-app-starter-maui](https://github.com/AppAmbit/organization-app-starter-maui) |

---

## Other SDKs

Open-source, one per platform. Analytics, crashes, session timeline, CMS, database, and remote config all in the same package.

> One .NET SDK repo, three targets: MAUI, WPF/WinUI, and Avalonia each ship as separate packages from the same source.

| Platform | Repo | Package |
| --- | --- | --- |
| **React Native** *(you are here)* | [appambit-sdk-react-native](https://github.com/AppAmbit/appambit-sdk-react-native) | [npm](https://www.npmjs.com/package/appambit) |
| iOS | [appambit-sdk-ios](https://github.com/AppAmbit/appambit-sdk-ios) | [CocoaPods](https://cocoapods.org/pods/appambitsdk) · [Swift Package Manager](https://github.com/AppAmbit/appambit-sdk-ios) |
| Android | [appambit-sdk-android](https://github.com/AppAmbit/appambit-sdk-android) | [Maven Central](https://central.sonatype.com/artifact/com.appambit/appambit) |
| .NET MAUI | [appambit-sdk-dotnet](https://github.com/AppAmbit/appambit-sdk-dotnet) | [NuGet](https://www.nuget.org/packages/com.AppAmbit.Maui) |
| Flutter | [appambit-sdk-flutter](https://github.com/AppAmbit/appambit-sdk-flutter) | [pub.dev](https://pub.dev/packages/appambit_sdk_flutter) |
| .NET (WPF/WinUI) | [appambit-sdk-dotnet](https://github.com/AppAmbit/appambit-sdk-dotnet) | [NuGet](https://www.nuget.org/packages/com.AppAmbit.Sdk) |
| Avalonia | [appambit-sdk-dotnet](https://github.com/AppAmbit/appambit-sdk-dotnet) | [NuGet](https://www.nuget.org/packages/com.AppAmbit.Avalonia) |

---

## REST API

No SDK? No problem. Every capability (sessions, events, logs, breadcrumbs, consumers, CMS, and the database) is also reachable directly over HTTP, for web apps, backend services, or anything without a native SDK.

📖 [Getting started guide](https://docs.appambit.com/Rest/getting-started/)

---

## Troubleshooting

* **No data in dashboard** → check the app key, endpoint, and network access
* **Dependency not resolving** → run `npm install` (or `yarn install`), then `pod install` in `ios/`
* **JS changes not showing up** → run `yarn prepare` in the package so `src/` is rebuilt into `lib/`
* **New native method not found** → rebuild the app; codegen regenerates the bridge specs during the native build, so a JS-only reload will not pick it up
* **Crash not appearing** → crashes are sent on next launch
* **No breadcrumbs on iOS** → `registerNavigationTracking` is Android-only, use `addBreadcrumb` instead
* **Push not arriving** → confirm `google-services.json` (Android) or the APNs key and push capability (iOS), and that `Push.start()` runs after `start()`

---

## Documentation

📚 [docs.appambit.com](https://docs.appambit.com)

---

## Community

- 💬 [Discord](https://discord.gg/nJyetYue2s)
- ✉️ [hello@appambit.com](mailto:hello@appambit.com)

---

## Pricing

Free plan with all core features, no credit card required. Paid plans start at $5.99/mo with hard spend caps, so there are no overage surprises.

🔗 [appambit.com](https://appambit.com) · [See pricing](https://appambit.com/pricing)

---

## License

Open source under the MIT License. See the [LICENSE](./LICENSE) file for the full terms.
