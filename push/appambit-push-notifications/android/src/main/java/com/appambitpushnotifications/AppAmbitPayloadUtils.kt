package com.appambitpushnotifications

import com.facebook.react.bridge.WritableMap
import com.google.firebase.messaging.RemoteMessage

/**
 * Shared helpers for building the cross-platform NotificationPayload on Android.
 *
 * Used by both delivery paths:
 *  - [AppAmbitNotificationSerializer]: app alive (reads from AppAmbitNotification).
 *  - [AppAmbitHeadlessService]: app killed (reads from Intent extras).
 */
internal object AppAmbitPayloadUtils {

    /** Internal _aa_* keys injected by checkInitialIntent (cold-start opened path). */
    val INTERNAL_KEYS = setOf(
        "_aa_image_url", "_aa_ticker", "_aa_sticky",
        "_aa_visibility", "_aa_channel_id", "_aa_priority",
        "_aa_tag", "_aa_sound", "_aa_click_action"
    )

    fun putStringOrNull(map: WritableMap, key: String, value: String?) {
        if (value != null) map.putString(key, value) else map.putNull(key)
    }

    /** RemoteMessage.PRIORITY_HIGH=1, PRIORITY_NORMAL=2, PRIORITY_UNKNOWN=0 */
    fun fcmPriorityToString(priority: Int): String? = when (priority) {
        1 -> "high"
        2 -> "normal"
        else -> null
    }

    fun fcmVisibilityToString(visibility: Int?): String? = when (visibility) {
        1 -> "public"
        0 -> "private"
        -1 -> "secret"
        else -> null
    }

    fun parseSticky(value: String?): Boolean? =
        value?.let { it.equals("true", ignoreCase = true) || it == "1" }

    /** FCM message-level fields, shared by both delivery paths. */
    fun putFcmMessageFields(payload: WritableMap, rm: RemoteMessage?) {
        if (rm != null) {
            putStringOrNull(payload, "messageId", rm.messageId)
            payload.putDouble("sentTime", rm.sentTime.toDouble())
            payload.putInt("ttl", rm.ttl)
            putStringOrNull(payload, "collapseKey", rm.collapseKey)
            putStringOrNull(payload, "from", rm.from)
            putStringOrNull(payload, "messagePriority", fcmPriorityToString(rm.priority))
            putStringOrNull(payload, "originalPriority", fcmPriorityToString(rm.originalPriority))
        } else {
            for (key in listOf("messageId", "sentTime", "ttl", "collapseKey",
                               "from", "messagePriority", "originalPriority"))
                payload.putNull(key)
        }
    }
}
