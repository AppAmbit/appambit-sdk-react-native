package com.appambitpushnotifications

import android.content.Context
import android.content.Intent
import android.util.Log
import com.appambit.sdk.models.AppAmbitNotification
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class AppAmbitHeadlessService : HeadlessJsTaskService() {

    companion object {
        private const val TAG = "AppAmbitHeadless"

        const val HEADLESS_TASK_NAME = "AppAmbitBackgroundNotification"

        // Intent extras
        private const val EXTRA_TITLE              = "aa_title"
        private const val EXTRA_BODY               = "aa_body"
        private const val EXTRA_IMAGE_URL          = "aa_image_url"
        private const val EXTRA_ANDROID_COLOR      = "aa_android_color"
        private const val EXTRA_ANDROID_ICON       = "aa_android_small_icon"
        private const val EXTRA_ANDROID_TICKER     = "aa_android_ticker"
        private const val EXTRA_ANDROID_STICKY     = "aa_android_sticky"
        private const val EXTRA_ANDROID_VISIBILITY = "aa_android_visibility"
        private const val EXTRA_ANDROID_CHANNEL_ID = "aa_android_channel_id"
        private const val EXTRA_ANDROID_TAG        = "aa_android_tag"
        private const val EXTRA_ANDROID_SOUND      = "aa_android_sound"
        private const val EXTRA_ANDROID_CLICK_ACTION = "aa_android_click_action"
        private const val EXTRA_DATA_KEYS          = "aa_data_keys"
        private const val EXTRA_DATA_VALS          = "aa_data_vals"

        private const val TASK_TIMEOUT_MS = 30_000L

        fun enqueueNotification(context: Context, notification: AppAmbitNotification) {
            Log.d(TAG, "Enqueueing headless task for: ${notification.title}")
            HeadlessJsTaskService.acquireWakeLockNow(context)
            val intent = buildIntent(context, notification)
            try {
                context.startService(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Could not start HeadlessService", e)
            }
        }

        private val INTERNAL_KEYS = setOf(
            "_aa_image_url", "_aa_ticker", "_aa_sticky",
            "_aa_visibility", "_aa_channel_id", "_aa_priority",
            "_aa_tag", "_aa_sound", "_aa_click_action"
        )

        private fun buildIntent(context: Context, notification: AppAmbitNotification): Intent {
            val data   = notification.data
            val intent = Intent(context, AppAmbitHeadlessService::class.java)

            intent.putExtra(EXTRA_TITLE,         notification.title)
            intent.putExtra(EXTRA_BODY,          notification.body)
            intent.putExtra(EXTRA_ANDROID_COLOR, notification.color)
            intent.putExtra(EXTRA_ANDROID_ICON,  notification.smallIconName)

            val imageUrl = notification.imageUrl
                ?: data["_aa_image_url"]
                ?: data["image_url"]
                ?: data["image"]
            intent.putExtra(EXTRA_IMAGE_URL, imageUrl)

            intent.putExtra(EXTRA_ANDROID_TICKER,       data["_aa_ticker"]       ?: data["ticker"])
            intent.putExtra(EXTRA_ANDROID_VISIBILITY,   data["_aa_visibility"]   ?: data["visibility"])
            intent.putExtra(EXTRA_ANDROID_CHANNEL_ID,   data["_aa_channel_id"]   ?: data["channelId"] ?: data["channel_id"])
            intent.putExtra(EXTRA_ANDROID_TAG,          data["_aa_tag"]          ?: data["tag"])
            intent.putExtra(EXTRA_ANDROID_SOUND,        data["_aa_sound"]        ?: data["sound"])
            intent.putExtra(EXTRA_ANDROID_CLICK_ACTION, data["_aa_click_action"] ?: data["clickAction"] ?: data["click_action"])

            val stickyStr = data["_aa_sticky"] ?: data["sticky"]
            if (stickyStr != null) {
                intent.putExtra(EXTRA_ANDROID_STICKY, stickyStr.equals("true", ignoreCase = true) || stickyStr == "1")
            }

            val filteredData = data.filterKeys { it !in INTERNAL_KEYS }
            if (filteredData.isNotEmpty()) {
                val keys   = filteredData.keys.toTypedArray()
                val values = keys.map { filteredData[it] }.toTypedArray()
                intent.putExtra(EXTRA_DATA_KEYS, keys)
                intent.putExtra(EXTRA_DATA_VALS, values)
            }
            return intent
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (application !is ReactApplication) {
            Log.e(TAG,
                "Application does not implement ReactApplication. " +
                "Headless JS cannot start. Ensure your Application class extends ReactApplication."
            )
            stopSelf()
            return START_NOT_STICKY
        }
        return super.onStartCommand(intent, flags, startId)
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras   = intent?.extras ?: return null
        val rm       = AppAmbitRemoteMessageStore.get()
        val fcmNotif = rm?.notification

        val payload = Arguments.createMap()
        payload.putString("title",    extras.getString(EXTRA_TITLE))
        payload.putString("body",     extras.getString(EXTRA_BODY))

        val imageUrl = extras.getString(EXTRA_IMAGE_URL) ?: fcmNotif?.imageUrl?.toString()
        if (imageUrl != null) payload.putString("imageUrl", imageUrl) else payload.putNull("imageUrl")

        val keys   = extras.getStringArray(EXTRA_DATA_KEYS)
        val values = extras.getStringArray(EXTRA_DATA_VALS)
        val dataMap = Arguments.createMap()
        if (keys != null && values != null) {
            keys.forEachIndexed { i, key ->
                if (i < values.size) dataMap.putString(key, values[i])
            }
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
        val androidMap = Arguments.createMap()

        putStringOrNull(androidMap, "color",        extras.getString(EXTRA_ANDROID_COLOR))
        putStringOrNull(androidMap, "smallIconName", extras.getString(EXTRA_ANDROID_ICON))

        // Intent extras take priority; fall back to RemoteMessage.Notification
        putStringOrNull(androidMap, "ticker",
            extras.getString(EXTRA_ANDROID_TICKER) ?: fcmNotif?.ticker)
        putStringOrNull(androidMap, "channelId",
            extras.getString(EXTRA_ANDROID_CHANNEL_ID) ?: fcmNotif?.channelId)
        putStringOrNull(androidMap, "tag",
            extras.getString(EXTRA_ANDROID_TAG) ?: fcmNotif?.tag)
        putStringOrNull(androidMap, "sound",
            extras.getString(EXTRA_ANDROID_SOUND) ?: fcmNotif?.sound)
        putStringOrNull(androidMap, "clickAction",
            extras.getString(EXTRA_ANDROID_CLICK_ACTION) ?: fcmNotif?.clickAction)
        putStringOrNull(androidMap, "visibility",
            extras.getString(EXTRA_ANDROID_VISIBILITY) ?: when (fcmNotif?.visibility) {
                1  -> "public"
                0  -> "private"
                -1 -> "secret"
                else -> null
            })

        when {
            extras.containsKey(EXTRA_ANDROID_STICKY) ->
                androidMap.putBoolean("sticky", extras.getBoolean(EXTRA_ANDROID_STICKY))
            fcmNotif != null ->
                androidMap.putBoolean("sticky", fcmNotif.sticky)
            else ->
                androidMap.putNull("sticky")
        }

        if (fcmNotif != null) {
            androidMap.putBoolean("localOnly", fcmNotif.localOnly)
        } else {
            androidMap.putNull("localOnly")
        }

        payload.putMap("android", androidMap)
        payload.putNull("ios")

        Log.d(TAG, "HeadlessJsTask config built for: ${extras.getString(EXTRA_TITLE)}")
        return HeadlessJsTaskConfig(
            HEADLESS_TASK_NAME,
            payload,
            TASK_TIMEOUT_MS,
            /* allowedInForeground = */ true
        )
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun putStringOrNull(map: com.facebook.react.bridge.WritableMap, key: String, value: String?) {
        if (value != null) map.putString(key, value) else map.putNull(key)
    }

    private fun fcmPriorityToString(priority: Int): String? = when (priority) {
        1    -> "high"
        2    -> "normal"
        else -> null
    }

}
