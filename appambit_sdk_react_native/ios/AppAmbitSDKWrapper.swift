import Foundation
import AppAmbitSdk

@objc(AppAmbitSdkWrapper)
public class AppAmbitSDKWrapper: NSObject {
  
  @objc public static let shared = AppAmbitSDKWrapper()
  
  // MARK: - Core
  @objc
  public static func start(appKey: String) {
    AppAmbit.start(appKey: appKey)
  }
  
  // MARK: - Analytics
  @objc
  public static func setUserId(userId: String) {
    Analytics.setUserId(userId)
  }
  
  @objc
  public static func setUserEmail(userEmail: String) {
    Analytics.setEmail(userEmail)
  }
  
  @objc
  public static func clearToken() {
    Analytics.clearToken()
  }
  
  @objc
  public static func startSession() {
    Analytics.startSession()
  }
  
  @objc
  public static func endSession() {
    Analytics.endSession()
  }

  @objc
  public static func enableManualSession() {
    Analytics.enableManualSession()
  }
  
  @objc
  public static func trackEvent(eventTitle: String, properties: [String: String]? = nil) {
      Analytics.trackEvent(eventTitle: eventTitle, data: properties ?? [:])
  }
  
  @objc
  public static func generateTestEvent() {
    Analytics.generateTestEvent()
  }
  
  // MARK: - Crashes
  @objc
  public static func didCrashInLastSession(completion: @escaping (Bool) -> Void) {
      Crashes.didCrashInLastSession { crashed in
          completion(crashed)
      }
  }

  @objc
  public static func generateTestCrash() {
    Crashes.generateTestCrash()
  }

  @objc
  public static func logError(message: String, properties: [String: String]? = nil) {
    Crashes.logError(message: message, properties: properties)
  }

  @objc
  public static func logError(exception: Error, properties: [String: String]? = nil) {
    Crashes.logError(exception: exception, properties: properties)
  }

}
