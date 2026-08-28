package com.appambit

import com.appambit.sdk.CloudCode
import com.appambit.sdk.enums.CloudCodeHttpMethod
import com.appambit.sdk.models.cloudcode.CloudCodeError
import com.appambit.sdk.models.cloudcode.CloudCodeRequest
import com.appambit.sdk.models.cloudcode.CloudCodeResponse
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.ConcurrentHashMap

@ReactModule(name = AppambitCloudCodeModule.NAME)
class AppambitCloudCodeModule(reactContext: ReactApplicationContext) :
    NativeAppambitCloudCodeSpec(reactContext) {

    override fun getName(): String = NAME

    private data class PendingRequest(
        val request: CloudCodeRequest<CloudCodeResponse>,
        val promise: Promise,
    )

    // Single source of truth for "who gets to resolve this promise": whichever caller wins
    // the atomic remove() (natural completion in `call()`'s then/onError, or an explicit
    // `cancel()`) is the only one allowed to settle the JS promise. The loser finds `null`
    // and does nothing. This is also why this module needs `invalidate()`: it is the first
    // module in this repo that keeps state alive between calls.
    private val pending = ConcurrentHashMap<String, PendingRequest>()

    override fun call(
        requestId: String,
        fn: String,
        method: String,
        query: ReadableMap,
        body: ReadableMap,
        headers: ReadableMap,
        promise: Promise,
    ) {
        val httpMethod = try {
            CloudCodeHttpMethod.valueOf(method)
        } catch (e: IllegalArgumentException) {
            rejectWithCode(promise, "INVALID_METHOD", "Unsupported Cloud Code method: $method")
            return
        }

        // CloudCode.ts always sends a body argument (defaulting to {} when the caller
        // passes none), but the native SDK's own untyped body:Map<String,Object>? distinguishes
        // "no body" (null — no Content-Type, no bytes on the wire) from "an explicit empty JSON
        // object" (non-null {} — serialized and sent). iOS's cloudCodeCall already normalizes
        // this (`body.isEmpty ? nil : body`); mirror that here so an RN call with no body option
        // produces the same HTTP request on both platforms instead of Android always sending a
        // real `{}` payload + Content-Type: application/json that iOS never sends.
        val nativeBody = readableMapToMap(body)

        val request = CloudCode.call(
            fn,
            httpMethod,
            readableMapToStringMap(query),
            if (nativeBody.isEmpty()) null else nativeBody,
            readableMapToStringMap(headers),
        )

        pending[requestId] = PendingRequest(request, promise)

        request.then { response ->
            pending.remove(requestId)?.promise?.resolve(cloudCodeResponseToWritableMap(response))
        }
        request.onError { error ->
            pending.remove(requestId)?.promise?.let { rejectCloudCodeError(it, error) }
        }
    }

    override fun cancel(requestId: String, promise: Promise) {
        val entry = pending.remove(requestId)
        if (entry != null) {
            entry.request.cancel()
            rejectWithCode(entry.promise, "CANCELLED", "Cloud Code request was cancelled")
        }
        // Idempotent by design: cancelling an unknown/already-settled requestId is a no-op,
        // not an error — matches the native CloudCodeRequest.cancel() contract.
        promise.resolve(null)
    }

    override fun invalidate() {
        super.invalidate()
        val entries = pending.values.toList()
        pending.clear()
        entries.forEach { it.request.cancel() }
    }

    // ---- ReadableMap/Array <-> plain Kotlin conversion ----
    //
    // Intentionally NOT shared with AppambitDatabaseModule.kt's near-identical-looking
    // readableArrayToList: that copy defaults a null string to "" (safe for SQL params,
    // where a bind value is never meant to be JS `null`) and flattens nested maps via
    // ReadableMap.toHashMap() (fine for SQL result rows, which aren't deeply nested).
    // Cloud Code needs the opposite on both counts — it must preserve an explicit JSON
    // `null` and fully recurse into nested objects/arrays, since it is transporting an
    // arbitrary caller-supplied JSON body, not SQL parameters. If you're fixing a bug in
    // one of these two, check whether it also applies to the other.
    private fun readableMapToStringMap(map: ReadableMap): Map<String, String> {
        val out = mutableMapOf<String, String>()
        val iterator = map.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            // Type-check before calling getString(): ReadableNativeMap.getString() throws
            // UnexpectedNativeTypeException (uncaught here, since call() has no try/catch) for
            // a non-string value instead of returning null. CloudCode.ts's snapshotStringMap
            // already rejects a non-string query/header value before this module is ever
            // reached, so this is a defense-in-depth guard against a caller that bypasses that
            // JS-side check (e.g. a deep import of NativeAppambitCloudCode) — drop the entry
            // instead of crashing the app on native-module misuse.
            if (map.getType(key) == ReadableType.String) {
                out[key] = map.getString(key) ?: ""
            }
        }
        return out
    }

    private fun readableMapToMap(map: ReadableMap): Map<String, Any?> {
        val out = mutableMapOf<String, Any?>()
        val iterator = map.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            out[key] = readableValueToAny(map, key)
        }
        return out
    }

    private fun readableValueToAny(map: ReadableMap, key: String): Any? {
        return when (map.getType(key)) {
            ReadableType.Null -> null
            ReadableType.Boolean -> map.getBoolean(key)
            ReadableType.Number -> {
                val num = map.getDouble(key)
                if (num == num.toLong().toDouble()) num.toLong() else num
            }
            ReadableType.String -> map.getString(key)
            ReadableType.Map -> readableMapToMap(map.getMap(key)!!)
            ReadableType.Array -> readableArrayToList(map.getArray(key)!!)
        }
    }

    private fun readableArrayToList(array: ReadableArray): List<Any?> {
        val list = mutableListOf<Any?>()
        for (i in 0 until array.size()) {
            when (array.getType(i)) {
                ReadableType.Null -> list.add(null)
                ReadableType.Boolean -> list.add(array.getBoolean(i))
                ReadableType.Number -> {
                    val num = array.getDouble(i)
                    list.add(if (num == num.toLong().toDouble()) num.toLong() else num)
                }
                ReadableType.String -> list.add(array.getString(i))
                ReadableType.Map -> list.add(readableMapToMap(array.getMap(i)!!))
                ReadableType.Array -> list.add(readableArrayToList(array.getArray(i)!!))
            }
        }
        return list
    }

    private fun putDynamic(map: WritableMap, key: String, value: Any?) {
        when (value) {
            null -> map.putNull(key)
            is Map<*, *> -> map.putMap(key, mapToWritableMap(value))
            is List<*> -> map.putArray(key, listToWritableArray(value))
            is Boolean -> map.putBoolean(key, value)
            is Int -> map.putInt(key, value)
            is Long -> map.putDouble(key, value.toDouble())
            is Double -> map.putDouble(key, value)
            is Float -> map.putDouble(key, value.toDouble())
            is String -> map.putString(key, value)
            else -> map.putString(key, value.toString())
        }
    }

    private fun pushDynamic(array: WritableArray, value: Any?) {
        when (value) {
            null -> array.pushNull()
            is Map<*, *> -> array.pushMap(mapToWritableMap(value))
            is List<*> -> array.pushArray(listToWritableArray(value))
            is Boolean -> array.pushBoolean(value)
            is Int -> array.pushInt(value)
            is Long -> array.pushDouble(value.toDouble())
            is Double -> array.pushDouble(value)
            is Float -> array.pushDouble(value.toDouble())
            is String -> array.pushString(value)
            else -> array.pushString(value.toString())
        }
    }

    private fun mapToWritableMap(value: Map<*, *>): WritableMap {
        val map = Arguments.createMap()
        for ((k, v) in value) putDynamic(map, k.toString(), v)
        return map
    }

    private fun listToWritableArray(value: List<*>): WritableArray {
        val array = Arguments.createArray()
        for (v in value) pushDynamic(array, v)
        return array
    }

    private fun cloudCodeResponseToWritableMap(response: CloudCodeResponse): WritableMap {
        val map = Arguments.createMap()
        putDynamic(map, "data", response.data)
        map.putInt("statusCode", response.statusCode)
        if (response.requestId != null) map.putString("requestId", response.requestId) else map.putNull("requestId")
        val headersMap = Arguments.createMap()
        response.headers.forEach { (k, v) -> headersMap.putString(k, v) }
        map.putMap("headers", headersMap)
        return map
    }

    private fun rejectWithCode(promise: Promise, code: String, message: String) {
        val userInfo = Arguments.createMap()
        userInfo.putString("code", code)
        promise.reject(code, message, userInfo)
    }

    private fun rejectCloudCodeError(promise: Promise, error: Throwable) {
        if (error !is CloudCodeError) {
            rejectWithCode(promise, "UNKNOWN", error.message ?: "Cloud Code request failed")
            return
        }
        val userInfo = Arguments.createMap()
        userInfo.putString("code", error.code.name)
        error.function?.let { userInfo.putString("function", it) }
        error.header?.let { userInfo.putString("header", it) }
        if (error.statusCode >= 0) userInfo.putInt("statusCode", error.statusCode)
        when (val body = error.body) {
            null -> {}
            is Map<*, *> -> userInfo.putMap("body", mapToWritableMap(body))
            is List<*> -> userInfo.putArray("body", listToWritableArray(body))
            else -> {}
        }
        error.rawBody?.let { userInfo.putString("rawBody", it) }
        error.requestId?.let { userInfo.putString("requestId", it) }
        promise.reject(error.code.name, error.message ?: "Cloud Code request failed", userInfo)
    }

    companion object {
        const val NAME = "AppAmbitCloudCode"
    }
}
