package com.appambitpushnotifications

import com.appambit.sdk.models.AppAmbitNotification
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

internal object AppAmbitNotificationSerializer {

    fun toEventPayload(notification: AppAmbitNotification): WritableMap {
        val data         = notification.data
        val rm           = AppAmbitRemoteMessageStore.get()
        val fcmNotif     = rm?.notification
        val payload      = Arguments.createMap()

        // ── Core fields ───────────────────────────────────────────────────────
        payload.putString("title", notification.title)
        payload.putString("body",  notification.body)

        val imageUrl = notification.imageUrl
            ?: data["_aa_image_url"]
            ?: data["image_url"]
            ?: data["image"]
            ?: fcmNotif?.imageUrl?.toString()
        AppAmbitPayloadUtils.putStringOrNull(payload, "imageUrl", imageUrl)

        // ── Custom data — strip internal _aa_* keys ───────────────────────────
        val dataMap = Arguments.createMap()
        data.forEach { (key, value) ->
            if (key !in AppAmbitPayloadUtils.INTERNAL_KEYS) dataMap.putString(key, value)
        }
        payload.putMap("data", dataMap)

        // ── FCM message-level fields ──────────────────────────────────────────
        AppAmbitPayloadUtils.putFcmMessageFields(payload, rm)

        // ── Android sub-object ────────────────────────────────────────────────
        payload.putMap("android", buildAndroidMap(data, notification, fcmNotif))
        payload.putNull("ios")

        return payload
    }

    private fun buildAndroidMap(
        data: Map<String, String>,
        notification: AppAmbitNotification,
        fcmNotif: com.google.firebase.messaging.RemoteMessage.Notification?
    ): WritableMap {
        val map = Arguments.createMap()

        // Fields from AppAmbitNotification model directly
        AppAmbitPayloadUtils.putStringOrNull(map, "color",         notification.color)
        AppAmbitPayloadUtils.putStringOrNull(map, "smallIconName", notification.smallIconName)

        // Fields read from data map (_aa_* prefix wins) with RemoteMessage.Notification fallback
        AppAmbitPayloadUtils.putStringOrNull(map, "ticker",
            data["_aa_ticker"] ?: data["ticker"] ?: fcmNotif?.ticker)
        AppAmbitPayloadUtils.putStringOrNull(map, "channelId",
            data["_aa_channel_id"] ?: data["channelId"] ?: data["channel_id"] ?: fcmNotif?.channelId)
        AppAmbitPayloadUtils.putStringOrNull(map, "tag",
            data["_aa_tag"] ?: data["tag"] ?: fcmNotif?.tag)
        AppAmbitPayloadUtils.putStringOrNull(map, "sound",
            data["_aa_sound"] ?: data["sound"] ?: fcmNotif?.sound)
        AppAmbitPayloadUtils.putStringOrNull(map, "clickAction",
            data["_aa_click_action"] ?: data["clickAction"] ?: data["click_action"] ?: fcmNotif?.clickAction)
        AppAmbitPayloadUtils.putStringOrNull(map, "visibility",
            data["_aa_visibility"] ?: data["visibility"]
                ?: AppAmbitPayloadUtils.fcmVisibilityToString(fcmNotif?.visibility))
        // sticky: data key takes priority, then RemoteMessage.Notification field
        val stickyParsed = AppAmbitPayloadUtils.parseSticky(data["_aa_sticky"] ?: data["sticky"])
        when {
            stickyParsed != null ->
                map.putBoolean("sticky", stickyParsed)
            fcmNotif != null ->
                map.putBoolean("sticky", fcmNotif.sticky)
            else ->
                map.putNull("sticky")
        }

        if (fcmNotif != null) {
            map.putBoolean("localOnly", fcmNotif.localOnly)
        } else {
            map.putNull("localOnly")
        }

        return map
    }

}
