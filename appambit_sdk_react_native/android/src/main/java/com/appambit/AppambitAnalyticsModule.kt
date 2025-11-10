package com.appambit

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator
import com.facebook.react.bridge.ReadableMap as RNReadableMap

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.appambit.sdk.Analytics

@ReactModule(name = AppambitAnalyticsModule.NAME)
class AppambitAnalyticsModule(reactContext: ReactApplicationContext) :
  NativeAppambitAnalyticsSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun setUserId(userId: String?) {
    Analytics.setUserId(userId)
  }

  override fun setUserEmail(userEmail: String?) {
    Analytics.setUserEmail(userEmail)
  }

  override fun clearToken() {
    Analytics.clearToken()
  }

  override fun startSession() {
    Analytics.startSession()
  }

  override fun endSession() {
    Analytics.endSession()
  }

  override fun enableManualSession() {
    Analytics.enableManualSession()
  }

  override fun trackEvent(eventTitle: String, properties: ReadableMap?) {
    val props: MutableMap<String, String>? = properties?.toHashMap()
      ?.mapValues { it.value.toString() }
      ?.toMutableMap()
    Analytics.trackEvent(eventTitle, props)
  }
  override fun generateTestEvent() {
    Analytics.generateTestEvent()
  }

  companion object {
    const val NAME = "AppAmbitAnalytics"
  }
}
