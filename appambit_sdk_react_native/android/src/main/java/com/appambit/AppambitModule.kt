package com.appambit

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.appambit.sdk.AppAmbit

@ReactModule(name = AppambitModule.NAME)
class AppambitModule(reactContext: ReactApplicationContext) :
  NativeAppambitCoreSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun start(appkey: String) {
    AppAmbit.start(reactApplicationContext, appkey)
  }

  companion object {
    const val NAME = "AppAmbitCore"
  }
}
