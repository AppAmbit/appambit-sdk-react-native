package com.appambit

import com.appambit.sdk.Cms
import com.appambit.sdk.services.interfaces.ICmsQuery
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject

class AppambitCmsModule(reactContext: ReactApplicationContext) : NativeAppambitCmsSpec(reactContext) {

    override fun getName(): String {
        return NAME
    }

    override fun getList(contentType: String, filters: ReadableArray, promise: Promise) {
        try {
            val query: ICmsQuery<JSONObject> = Cms.content(contentType, java.lang.Object::class.java as Class<JSONObject>)

            for (i in 0 until filters.size()) {
                val filter = filters.getMap(i) ?: continue

                if (filter.hasKey("method")) {
                    val method = filter.getString("method")
                    val args = filter.getArray("args")
                    if (method != null && args != null) {
                        when (method) {
                            "search" -> query.search(args.getString(0))
                            "startsWith" -> query.startsWith(args.getString(0), args.getString(1))
                            "inList" -> {
                                val listArgs = args.getArray(1)
                                val list = mutableListOf<String>()
                                if (listArgs != null) {
                                    for (j in 0 until listArgs.size()) list.add(listArgs.getString(j) ?: "")
                                }
                                query.inList(args.getString(0) ?: "", list)
                            }
                            "notInList" -> {
                                val listArgs = args.getArray(1)
                                val list = mutableListOf<String>()
                                if (listArgs != null) {
                                    for (j in 0 until listArgs.size()) list.add(listArgs.getString(j) ?: "")
                                }
                                query.notInList(args.getString(0) ?: "", list)
                            }
                            "orderByAscending" -> query.orderByAscending(args.getString(0))
                            "orderByDescending" -> query.orderByDescending(args.getString(0))
                            "getPage" -> query.getPage(args.getInt(0))
                            "getPerPage" -> query.getPerPage(args.getInt(0))
                        }
                    }
                } else if (filter.hasKey("field") && filter.hasKey("operator")) {
                    val field = filter.getString("field") ?: continue
                    val op = filter.getString("operator") ?: "="

                    if (filter.getType("value") == ReadableType.Number) {
                        val value = filter.getDouble("value")
                        when (op) {
                            ">" -> query.greaterThan(field, value)
                            ">=" -> query.greaterThanOrEqual(field, value)
                            "<" -> query.lessThan(field, value)
                            "<=" -> query.lessThanOrEqual(field, value)
                            "=" -> query.equals(field, value.toString())
                            "!=" -> query.notEquals(field, value.toString())
                        }
                    } else if (filter.getType("value") == ReadableType.String) {
                        val value = filter.getString("value") ?: ""
                        when (op) {
                            "=" -> query.equals(field, value)
                            "!=" -> query.notEquals(field, value)
                            "LIKE" -> query.contains(field, value)
                        }
                    }
                }
            }

            query.list.then { items ->
                val result = Arguments.createArray()
                if (items != null) {
                    for (item in items) {
                        result.pushMap(convertJsonToMap(item))
                    }
                }
                promise.resolve(result)
            }
        } catch (e: Exception) {
            promise.reject("CMS_GET_LIST_ERROR", e.message, e)
        }
    }

    override fun clearCache(contentType: String) {
        Cms.clearCache(contentType)
    }

    override fun clearAllCache() {
        Cms.clearAllCache()
    }

    private fun convertJsonToMap(jsonObject: JSONObject): WritableMap {
        val map = Arguments.createMap()
        val iterator = jsonObject.keys()
        while (iterator.hasNext()) {
            val key = iterator.next()
            val value = jsonObject.get(key)
            if (value is String) map.putString(key, value)
            else if (value is Int) map.putInt(key, value)
            else if (value is Double) map.putDouble(key, value)
            else if (value is Boolean) map.putBoolean(key, value)
            else if (value is JSONObject) map.putMap(key, convertJsonToMap(value))
            else if (value is JSONArray) map.putArray(key, convertJsonToArray(value))
        }
        return map
    }

    private fun convertJsonToArray(jsonArray: JSONArray): WritableArray {
        val array = Arguments.createArray()
        for (i in 0 until jsonArray.length()) {
            val value = jsonArray.get(i)
            if (value is String) array.pushString(value)
            else if (value is Int) array.pushInt(value)
            else if (value is Double) array.pushDouble(value)
            else if (value is Boolean) array.pushBoolean(value)
            else if (value is JSONObject) array.pushMap(convertJsonToMap(value))
            else if (value is JSONArray) array.pushArray(convertJsonToArray(value))
        }
        return array
    }

    companion object {
        const val NAME = "AppAmbitCms"
    }
}
