package com.appambitpushnotifications

import com.appambit.sdk.models.AppAmbitNotification
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Converts internal SDK models to React Native-compatible WritableMaps.
 *
 * Shape matches the .NET PushNotificationData record:
 * {
 *   title:    string | null,
 *   body:     string | null,
 *   imageUrl: string | null,
 *   data:     { [key: string]: string },
 *   android: {
 *     color:         string | null,
 *     smallIconName: string | null,
 *   } | null,
 *   ios: null  // always null on Android
 * }
 */
internal object AppAmbitNotificationSerializer {

    /**
     * Converts an [AppAmbitNotification] to a JS-friendly [WritableMap]
     * matching the [NotificationPayload] TypeScript interface.
     */
    fun toEventPayload(notification: AppAmbitNotification): WritableMap {
        val payload = Arguments.createMap()

        // ── Core fields ─────────────────────────────────────────────────────
        payload.putString("title",    notification.title)
        payload.putString("body",     notification.body)
        payload.putString("imageUrl", notification.imageUrl)

        // ── Custom data ──────────────────────────────────────────────────────
        val dataMap = Arguments.createMap()
        notification.data.forEach { (key, value) -> dataMap.putString(key, value) }
        payload.putMap("data", dataMap)

        // ── Android-specific sub-object ──────────────────────────────────────
        val androidMap = Arguments.createMap()
        androidMap.putString("color",         notification.color)
        androidMap.putString("smallIconName",  notification.smallIconName)
        payload.putMap("android", androidMap)

        // ── iOS sub-object (null on Android) ────────────────────────────────
        payload.putNull("ios")

        return payload
    }
}