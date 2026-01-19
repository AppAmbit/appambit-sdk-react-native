package com.appambitpushnotifications

import android.app.Activity
import androidx.activity.ComponentActivity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule
import com.appambit.sdk.PushNotifications
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = AppambitPushNotificationsModule.NAME)
class AppambitPushNotificationsModule(reactContext: ReactApplicationContext) :
  NativeAppambitPushNotificationsSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun start() {
    PushNotifications.start(reactApplicationContext.applicationContext)
  }

  override fun requestNotificationPermission() {
    val activity: Activity? = currentActivity
    if (activity is ComponentActivity) {
      PushNotifications.requestNotificationPermission(activity)
    }
  }

  override fun requestNotificationPermissionWithResult(promise: Promise) {
    val activity: Activity? = currentActivity
    if (activity is ComponentActivity) {
      PushNotifications.requestNotificationPermission(activity) { isGranted ->
        promise.resolve(isGranted)
      }
    } else {
        promise.resolve(false)
    }
  }

  override fun setNotificationsEnabled(enabled: Boolean) {
    PushNotifications.setNotificationsEnabled(
      reactApplicationContext.applicationContext,
      enabled
    )
  }

  override fun isNotificationsEnabled(promise: Promise) {
    val enabled = PushNotifications.isNotificationsEnabled(
      reactApplicationContext.applicationContext
    )
    promise.resolve(enabled)
  }

  override fun setNotificationCustomizer() {
    try {
      PushNotifications.setNotificationCustomizer { _, _, notification ->
        val params = Arguments.createMap()

        val notificationMap = Arguments.createMap()
        notificationMap.putString("title", notification.title)
        notificationMap.putString("body", notification.body)

        params.putMap("notification", notificationMap)

        notification.data?.let { data ->
          val dataMap = Arguments.createMap()
          for ((key, value) in data) {
            dataMap.putString(key, value)
          }
          params.putMap("data", dataMap)
        }
        sendEvent("onNotificationReceived", params)
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  private fun sendEvent(eventName: String, params: WritableMap?) {
    if (reactApplicationContext.hasActiveReactInstance()) {
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
    }
  }

  override fun addListener(eventName: String?) {}

  override fun removeListeners(count: Double) {}

  companion object {
    const val NAME = "AppambitPushNotifications"
  }
}
