# AppAmbit React Native SDK

**Track. Debug. Distribute.**
**AppAmbit: track, debug, and distribute your apps from one dashboard.**

Lightweight SDK for analytics, events, logging, crashes, and offline support. Simple setup, minimal overhead.

> Full product docs live here: **[docs.appambit.com](https://docs.appambit.com)**

---

## Contents

* [Features](#features)
* [Requirements](#requirements)
* [Install](#install)
* [Quickstart](#quickstart)
* [Usage](#usage)
* [Release Distribution](#release-distribution)
* [Privacy and Data](#privacy-and-data)
* [Troubleshooting](#troubleshooting)
* [Contributing](#contributing)
* [Versioning](#versioning)
* [Security](#security)
* [License](#license)

---

## Features

* Session analytics with automatic lifecycle tracking
* Event tracking with custom properties
* Error logging for quick diagnostics 
* Crash capture with stack traces and threads
* Offline support with batching, retry, and queue
* Create mutliple app profiles for staging and production
* Small footprint

---

## Requirements

- Node >= 20
- Yarn >=3.6.1
- **Android SDK with:**
    - Android 5.0+
    - compileSdkVersion 34
    - targetSdkVersion 34
    - minSdkVersion 21
- **iOS SDK with:**
    - Xcode 15+ (for iOS)
    - macOS 13+

---


## Install

### NPM

Add the package to your React Native project:

```bash
npm install appambit
# or specify version
npm install appambit@0.1.0
```
---

## Quickstart

Initialize the SDK with your **API key**.

### Javascript

```javascript
export default function App() {
  useEffect(() => {
    start("<YOUR-APPKEY>");
  }, []);
}
```

---

## Android App Requirements

Add these permissions to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
```

---

## Usage

* **Session activity** – automatically tracks user session starts, stops, and durations
* **Track events** – send structured events with custom properties

  ```javascript
    trackEvent("ButtonClicked", {"Count": "41"})
  ```
* **Logs**: add structured log messages for debugging

  ```javascript
    try {
        throw new Error();
    } catch (e) {
        logError(
        { stack: e.stack, 
        exception: e, 
        classFqn: e.constructor.name, 
        properties: {"user_id": "1"} },
        );
    }
  ```
* **Crash Reporting**: uncaught crashes are automatically captured and uploaded on next launch

---

## Release Distribution

* Push the artifact to your AppAmbit dashboard for distribution via email and direct installation.

---

## Privacy and Data

* The SDK batches and transmits data efficiently
* You control what is sent — avoid secrets or sensitive PII
* Supports compliance with Google Play policies

For details, see the docs: **[docs.appambit.com](https://docs.appambit.com)**

---

## Troubleshooting

* **No data in dashboard** → check API key, endpoint, and network access
* **React Native dependency not resolving** → run `npm install` and `yarn install` in folder `appambit_test_app` and verify again
* **Crash not appearing** → crashes are sent on next launch

---

## Contributing

We welcome issues and pull requests.

* Fork the repo
* Create a feature branch
* Add tests where applicable
* Open a PR with a clear summary

Please follow React Native API design guidelines and document public APIs.

---

## Versioning

Semantic Versioning (`MAJOR.MINOR.PATCH`) is used.

* Breaking changes → **major**
* New features → **minor**
* Fixes → **patch**

---

## Security

If you find a security issue, please contact us at **[hello@appambit.com](mailto:hello@appambit.com)** rather than opening a public issue.

---

## License

Open source under the terms described in the [LICENSE](./LICENSE) file.

---

## Links

* **Docs**: [docs.appambit.com](https://docs.appambit.com)
* **Dashboard**: [appambit.com](https://appambit.com)
* **Discord**: [discord.gg](https://discord.gg/nJyetYue2s)
* **Examples**: Sample React Native test app included in repo.