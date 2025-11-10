package com.appambit

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator
import com.facebook.react.bridge.ReadableMap as RNReadableMap

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.appambit.sdk.Crashes
@ReactModule(name = AppambitCrashesModule.NAME)
class AppambitCrashesModule(reactContext: ReactApplicationContext) :
  NativeAppambitCrashesSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun didCrashInLastSession(): Boolean {
    return Crashes.didCrashInLastSession()
  }

  override fun generateTestCrash() {
    Thread {
      Crashes.generateTestCrash()
    }.start()
  }

  override fun logErrorMessage(message: String, properties: ReadableMap?) {

    val props: MutableMap<String, String> = properties?.toHashMap()
      ?.mapValues { it.value.toString() }
      ?.toMutableMap() ?: mutableMapOf()

    Crashes.logError(message, props)
  }

  override fun logError(errorMap: ReadableMap) {
    val map = errorMap.toHashMap()

    val message = map["message"]?.toString() ?: "Unknown error"
    val stack = map["stack"]?.toString()
    val classFqn = map["classFqn"]?.toString()
    val fileName = map["fileName"]?.toString()

    val lineNumber = try {
      when (val lineNum = map["lineNumber"]) {
        is Number -> lineNum.toInt()
        is String -> lineNum.toIntOrNull()
        else -> null
      }
    } catch (e: Exception) {
      null
    }

    val properties: Map<String, String> =
      ((map["properties"] as? Map<*, *>)?.map { (k, v) ->
        k.toString() to v.toString()
      }?.toMap()) ?: emptyMap()

    val finalProperties = properties.toMutableMap()

    val exception = Exception(message)

    if (!stack.isNullOrEmpty()) {
      val stackTraceElements: Array<StackTraceElement> = stack.lines().map { line ->
        StackTraceElement(
          classFqn,
          line,
          fileName,
          lineNumber ?: 0
        )
      }.toTypedArray()

      exception.stackTrace = stackTraceElements
    }
    Crashes.logError(exception, finalProperties.toMap())
  }

  companion object {
    const val NAME = "AppAmbitCrashes"
  }
}
