package com.appambitpushnotifications

import com.appambit.sdk.models.AppAmbitNotification
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

internal object AppAmbitNotificationSerializer {

    // Keys injected by checkInitialIntent (cold-start opened path).
    private val INTERNAL_KEYS = setOf(
        "_aa_image_url", "_aa_ticker", "_aa_sticky",
        "_aa_visibility", "_aa_channel_id", "_aa_priority",
        "_aa_tag", "_aa_sound", "_aa_click_action"
    )

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
        putStringOrNull(payload, "imageUrl", imageUrl)

        // ── Custom data — strip internal _aa_* keys ───────────────────────────
        val dataMap = Arguments.createMap()
        data.forEach { (key, value) ->
            if (key !in INTERNAL_KEYS) dataMap.putString(key, value)
        }
        payload.putMap("data", dataMap)

        // ── FCM message-level fields ──────────────────────────────────────────
        if (rm != null) {
            putStringOrNull(payload, "messageId",        rm.messageId)
            payload.putDouble("sentTime",                rm.sentTime.toDouble())
            payload.putInt("ttl",                        rm.ttl)
            putStringOrNull(payload, "collapseKey",      rm.collapseKey)
            putStringOrNull(payload, "from",             rm.from)
            putStringOrNull(payload, "messagePriority",  fcmPriorityToString(rm.priority))
            putStringOrNull(payload, "originalPriority", fcmPriorityToString(rm.originalPriority))
        } else {
            for (key in listOf("messageId", "sentTime", "ttl", "collapseKey", "from", "messagePriority", "originalPriority"))
                payload.putNull(key)
        }

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
        putStringOrNull(map, "color",         notification.color)
        putStringOrNull(map, "smallIconName", notification.smallIconName)

        // Fields read from data map (_aa_* prefix wins) with RemoteMessage.Notification fallback
        putStringOrNull(map, "ticker",
            data["_aa_ticker"] ?: data["ticker"] ?: fcmNotif?.ticker)
        putStringOrNull(map, "channelId",
            data["_aa_channel_id"] ?: data["channelId"] ?: data["channel_id"] ?: fcmNotif?.channelId)
        putStringOrNull(map, "tag",
            data["_aa_tag"] ?: data["tag"] ?: fcmNotif?.tag)
        putStringOrNull(map, "sound",
            data["_aa_sound"] ?: data["sound"] ?: fcmNotif?.sound)
        putStringOrNull(map, "clickAction",
            data["_aa_click_action"] ?: data["clickAction"] ?: data["click_action"] ?: fcmNotif?.clickAction)
        putStringOrNull(map, "visibility",
            data["_aa_visibility"] ?: data["visibility"] ?: when (fcmNotif?.visibility) {
                1  -> "public"
                0  -> "private"
                -1 -> "secret"
                else -> null
            })
        // sticky: data key takes priority, then RemoteMessage.Notification field
        val stickyStr = data["_aa_sticky"] ?: data["sticky"]
        when {
            stickyStr != null ->
                map.putBoolean("sticky", stickyStr.equals("true", ignoreCase = true) || stickyStr == "1")
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

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun putStringOrNull(map: WritableMap, key: String, value: String?) {
        if (value != null) map.putString(key, value) else map.putNull(key)
    }

    // RemoteMessage.PRIORITY_HIGH=1, PRIORITY_NORMAL=2, PRIORITY_UNKNOWN=0
    private fun fcmPriorityToString(priority: Int): String? = when (priority) {
        1    -> "high"
        2    -> "normal"
        else -> null
    }

}
