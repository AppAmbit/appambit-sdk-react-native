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
        val data = notification.data
        if (data != null && data.isNotEmpty()) {
          val params = Arguments.createMap()
          for ((key, value) in data) {
            params.putString(key, value)
          }
          sendEvent("onNotificationReceived", params)
        }
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
