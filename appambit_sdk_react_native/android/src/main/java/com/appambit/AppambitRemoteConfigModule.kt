package com.appambit

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.appambit.sdk.RemoteConfig

@ReactModule(name = AppambitRemoteConfigModule.NAME)
class AppambitRemoteConfigModule(reactContext: ReactApplicationContext) :
  NativeAppambitRemoteConfigSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun enable() {
    RemoteConfig.enable()
  }

  override fun getString(key: String?): String {
    return RemoteConfig.getString(key) ?: ""
  }

  override fun getBoolean(key: String?): Boolean {
    return RemoteConfig.getBoolean(key)
  }

  override fun getInt(key: String?): Double {
    return RemoteConfig.getInt(key).toDouble()
  }

  override fun getDouble(key: String?): Double {
    return RemoteConfig.getDouble(key)
  }

  companion object {
    const val NAME = "AppAmbitRemoteConfig"
  }
}
