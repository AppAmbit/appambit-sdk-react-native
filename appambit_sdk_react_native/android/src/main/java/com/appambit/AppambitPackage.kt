package com.appambit

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

class AppambitPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      AppambitModule.NAME -> AppambitModule(reactContext)
      AppambitCrashesModule.NAME -> AppambitCrashesModule(reactContext)
      AppambitAnalyticsModule.NAME -> AppambitAnalyticsModule(reactContext)
      AppambitRemoteConfigModule.NAME -> AppambitRemoteConfigModule(reactContext)
      else -> null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()

      fun addInfo(name: String) {
        moduleInfos[name] = ReactModuleInfo(
          name,
          name,
          false,
          false,
          false,
          true
        )
      }

      addInfo(AppambitModule.NAME)
      addInfo(AppambitCrashesModule.NAME)
      addInfo(AppambitAnalyticsModule.NAME)
      addInfo(AppambitRemoteConfigModule.NAME)

      moduleInfos
    }
  }
}
