package com.appambitpushnotifications

import com.appambit.sdk.models.AppAmbitNotification
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Converts internal SDK models to React Native-compatible WritableMaps.
 *
 * Centralising all serialisation here means:
 * - No magic strings in Module / HeadlessTask / ServiceExtension
 * - Easy to extend with new fields without touching multiple files
 * - Null-safety enforced in a single place
 */
internal object AppAmbitNotificationSerializer {

    /**
     * Converts an [AppAmbitNotification] to a JS-friendly [WritableMap].
     *
     * Shape delivered to JavaScript:
     * {
     *   id:           string | null,
     *   title:        string | null,
     *   body:         string | null,
     *   color:        string | null,
     *   smallIcon:    string | null,
     *   data:         { [key: string]: string }
     * }
     */
    fun toWritableMap(notification: AppAmbitNotification): WritableMap {
        val map = Arguments.createMap()

        map.putString("title",     notification.title)
        map.putString("body",      notification.body)
        map.putString("color",     notification.color)
        map.putString("smallIcon", notification.smallIconName)

        val dataMap = Arguments.createMap()
        notification.data.forEach { (key, value) ->
            dataMap.putString(key, value)
        }
        map.putMap("data", dataMap)

        return map
    }

    /**
     * Wraps a notification map inside an outer envelope:
     * { notification: {...}, data: {...} }
     *
     * Matches the shape expected by the JS listeners defined in index.tsx.
     */
    fun toEventPayload(notification: AppAmbitNotification): WritableMap {
        val payload  = Arguments.createMap()
        val inner    = toWritableMap(notification)
        val dataMap  = Arguments.createMap()
        notification.data.forEach { (key, value) -> dataMap.putString(key, value) }

        payload.putMap("notification", inner)
        payload.putMap("data", dataMap)
        return payload
    }
}