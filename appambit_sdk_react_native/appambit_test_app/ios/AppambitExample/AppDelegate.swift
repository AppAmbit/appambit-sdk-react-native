import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import AppAmbitSdkPushNotifications
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "AppambitExample",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    AppAmbitPushWrapper.didReceiveOpenedNotification(userInfo)
    completionHandler()
  }

  func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Forward the payload to trigger the background listener in React Native.
    AppAmbitPushWrapper.didReceiveBackgroundNotification(userInfo)
    
    // Request extra time from the OS to ensure React Native and AsyncStorage finish
    var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    backgroundTask = application.beginBackgroundTask {
      // If time runs out, end the task
      application.endBackgroundTask(backgroundTask)
      backgroundTask = .invalid
    }
    
    // Give JS 5 seconds to process, then tell OS we are done
    DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
      completionHandler(.newData)
      if backgroundTask != .invalid {
        application.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
      }
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
