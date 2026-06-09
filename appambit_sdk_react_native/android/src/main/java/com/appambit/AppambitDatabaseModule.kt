package com.appambit

import com.appambit.sdk.AppAmbitDb
import com.appambit.sdk.models.db.DbResult
import com.appambit.sdk.models.db.DbStatement
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = AppambitDatabaseModule.NAME)
class AppambitDatabaseModule(reactContext: ReactApplicationContext) :
    NativeAppambitDatabaseSpec(reactContext) {

    override fun getName(): String = NAME

    override fun execute(sql: String, params: ReadableArray, promise: Promise) {
        try {
            val paramList = readableArrayToList(params)
            val future = if (paramList.isEmpty()) {
                AppAmbitDb.execute(sql)
            } else {
                AppAmbitDb.execute(sql, *paramList.toTypedArray())
            }
            future.then { result ->
                promise.resolve(dbResultToWritableMap(result))
            }
            future.onError { e ->
                promise.reject("DB_EXECUTE_ERROR", e.message, e)
            }
        } catch (e: Exception) {
            promise.reject("DB_EXECUTE_ERROR", e.message, e)
        }
    }

    override fun batch(statements: ReadableArray, transaction: Boolean, promise: Promise) {
        try {
            val stmtList = mutableListOf<DbStatement>()
            for (i in 0 until statements.size()) {
                val map = statements.getMap(i) ?: continue
                val sql = map.getString("sql") ?: continue
                val paramsArray = if (map.hasKey("params")) map.getArray("params") else null
                val stmt = if (paramsArray != null && paramsArray.size() > 0) {
                    DbStatement.of(sql, *readableArrayToList(paramsArray).toTypedArray())
                } else {
                    DbStatement.of(sql)
                }
                stmtList.add(stmt)
            }

            val future = if (transaction) {
                AppAmbitDb.batchInTransaction(*stmtList.toTypedArray())
            } else {
                AppAmbitDb.batch(*stmtList.toTypedArray())
            }

            future.then { results ->
                val array = Arguments.createArray()
                results.forEach { result -> array.pushMap(dbResultToWritableMap(result)) }
                promise.resolve(array)
            }
            future.onError { e ->
                promise.reject("DB_BATCH_ERROR", e.message, e)
            }
        } catch (e: Exception) {
            promise.reject("DB_BATCH_ERROR", e.message, e)
        }
    }

    private fun readableArrayToList(array: ReadableArray): List<Any> {
        val list = mutableListOf<Any>()
        for (i in 0 until array.size()) {
            when (array.getType(i)) {
                ReadableType.Null -> list.add("null")
                ReadableType.Boolean -> list.add(array.getBoolean(i))
                ReadableType.Number -> {
                    val num = array.getDouble(i)
                    list.add(if (num == num.toLong().toDouble()) num.toLong() else num)
                }
                ReadableType.String -> list.add(array.getString(i) ?: "")
                ReadableType.Map -> list.add(array.getMap(i)?.toHashMap() ?: emptyMap<String, Any>())
                ReadableType.Array -> list.add(readableArrayToList(array.getArray(i)!!))
            }
        }
        return list
    }

    private fun dbResultToWritableMap(result: DbResult): WritableMap {
        val map = Arguments.createMap()

        val columnsArray = Arguments.createArray()
        result.columns.forEach { columnsArray.pushString(it) }
        map.putArray("columns", columnsArray)

        val rowsArray = Arguments.createArray()
        result.rows.forEach { row ->
            val rowArray = Arguments.createArray()
            row.forEach { cell ->
                when (cell) {
                    null -> rowArray.pushNull()
                    is Boolean -> rowArray.pushBoolean(cell)
                    is Int -> rowArray.pushInt(cell)
                    is Long -> rowArray.pushDouble(cell.toDouble())
                    is Double -> rowArray.pushDouble(cell)
                    is Float -> rowArray.pushDouble(cell.toDouble())
                    is String -> rowArray.pushString(cell)
                    else -> rowArray.pushString(cell.toString())
                }
            }
            rowsArray.pushArray(rowArray)
        }
        map.putArray("rows", rowsArray)

        map.putInt("rowsRead", result.rowsRead)
        map.putInt("rowsWritten", result.rowsWritten)
        if (result.hasError()) {
            map.putString("error", result.error)
        }

        return map
    }

    companion object {
        const val NAME = "AppAmbitDatabase"
    }
}
