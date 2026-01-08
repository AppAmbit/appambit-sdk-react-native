package com.appambitpushnotifications

import android.app.Activity
import androidx.activity.ComponentActivity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule
import com.appambit.sdk.PushNotifications

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

  // Se asegura de que el parámetro sea Promise (con la P mayúscula e importado)
  override fun isNotificationsEnabled(promise: Promise) {
    val enabled = PushNotifications.isNotificationsEnabled(
      reactApplicationContext.applicationContext
    )
    promise.resolve(enabled)
  }

  companion object {
    const val NAME = "AppambitPushNotifications"
  }
}
