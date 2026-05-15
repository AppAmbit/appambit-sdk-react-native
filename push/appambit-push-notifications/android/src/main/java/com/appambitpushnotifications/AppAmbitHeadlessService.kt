package com.appambitpushnotifications

import android.content.Context
import android.content.Intent
import android.util.Log
import com.appambit.sdk.models.AppAmbitNotification
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * AppAmbitHeadlessService
 *
 * Launches a Headless JS task when a push notification arrives in
 * background / killed state. Mirrors the pattern used by react-native-firebase's
 * ReactNativeFirebaseMessagingHeadlessTask.
 *
 * How it works:
 * 1. [AppAmbitRNServiceExtension.onNotificationBackground] calls [enqueueNotification],
 *    passing the FirebaseMessagingService instance as context (always valid).
 * 2. [enqueueNotification] acquires a wakelock, packs the payload, and starts this Service.
 * 3. Android OS creates/reuses the app process and starts this Service.
 * 4. [onStartCommand] validates ReactApplication, then delegates to parent.
 * 5. [getTaskConfig] is called by the RN Headless machinery → HeadlessJsTaskConfig returned.
 * 6. React Native runs the registered JS task with the notification payload.
 *
 * JS-side registration (the consuming app must do this in index.js):
 *
 *   AppRegistry.registerHeadlessTask(
 *     BACKGROUND_NOTIFICATION_TASK,
 *     () => async (notification) => { ... }
 *   );
 */
class AppAmbitHeadlessService : HeadlessJsTaskService() {

    companion object {
        private const val TAG = "AppAmbitHeadless"

        /** The JS task name that must be registered with AppRegistry.registerHeadlessTask. */
        const val HEADLESS_TASK_NAME = "AppAmbitBackgroundNotification"

        // Intent extras
        private const val EXTRA_TITLE      = "aa_title"
        private const val EXTRA_BODY       = "aa_body"
        private const val EXTRA_COLOR      = "aa_color"
        private const val EXTRA_SMALL_ICON = "aa_small_icon"
        private const val EXTRA_DATA_KEYS  = "aa_data_keys"
        private const val EXTRA_DATA_VALS  = "aa_data_vals"

        // Maximum time (ms) to allow the JS task to run.
        private const val TASK_TIMEOUT_MS = 30_000L

        /**
         * Starts this service with the notification payload.
         *
         * CRITICAL: [context] is the FirebaseMessagingService instance passed from
         * [AppAmbitRNServiceExtension]. It is ALWAYS valid — even in killed state,
         * even before the React Native bridge exists.
         *
         * We do NOT use [AppAmbitContextHolder] here. That holder is populated when the
         * TurboModule initialises (i.e. when the RN bridge is ready), which happens AFTER
         * the FCM callback fires in killed state — so it would always be null.
         *
         * Pattern mirrors react-native-firebase:
         *   1. acquireWakeLockNow — prevents the process from dying before the JS runtime starts.
         *   2. startService (NOT startForegroundService) — HeadlessJsTaskService manages its own
         *      lifecycle; a visible foreground notification is not required here.
         */
        fun enqueueNotification(context: Context, notification: AppAmbitNotification) {
            Log.d(TAG, "Enqueueing headless task for: ${notification.title}")

            // Acquire wakelock BEFORE startService so Android cannot kill the process
            // in the narrow window between the call and HeadlessJsTaskService taking control.
            HeadlessJsTaskService.acquireWakeLockNow(context)

            val intent = buildIntent(context, notification)
            try {
                context.startService(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Could not start HeadlessService", e)
            }
        }

        private fun buildIntent(context: Context, notification: AppAmbitNotification): Intent {
            val intent = Intent(context, AppAmbitHeadlessService::class.java)
            intent.putExtra(EXTRA_TITLE,      notification.title)
            intent.putExtra(EXTRA_BODY,       notification.body)
            intent.putExtra(EXTRA_COLOR,      notification.color)
            intent.putExtra(EXTRA_SMALL_ICON, notification.smallIconName)

            val data = notification.data
            if (data.isNotEmpty()) {
                val keys   = data.keys.toTypedArray()
                val values = keys.map { data[it] }.toTypedArray()
                intent.putExtra(EXTRA_DATA_KEYS, keys)
                intent.putExtra(EXTRA_DATA_VALS, values)
            }
            return intent
        }
    }

    // ── HeadlessJsTaskService ─────────────────────────────────────────────────

    /**
     * Validates the ReactApplication contract before delegating to the parent.
     * HeadlessJsTaskService crashes silently if the Application class does not
     * implement ReactApplication, so we provide an explicit, actionable error.
     */
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
        val extras = intent?.extras ?: return null

        val data = Arguments.createMap()
        data.putString("title",     extras.getString(EXTRA_TITLE))
        data.putString("body",      extras.getString(EXTRA_BODY))
        data.putString("color",     extras.getString(EXTRA_COLOR))
        data.putString("smallIcon", extras.getString(EXTRA_SMALL_ICON))

        val keys   = extras.getStringArray(EXTRA_DATA_KEYS)
        val values = extras.getStringArray(EXTRA_DATA_VALS)
        val dataMap = Arguments.createMap()
        if (keys != null && values != null) {
            keys.forEachIndexed { i, key ->
                if (i < values.size) dataMap.putString(key, values[i])
            }
        }
        data.putMap("data", dataMap)

        Log.d(TAG, "HeadlessJsTask config built for: ${extras.getString(EXTRA_TITLE)}")
        return HeadlessJsTaskConfig(
            HEADLESS_TASK_NAME,
            data,
            TASK_TIMEOUT_MS,
            /* allowedInForeground = */ true
        )
    }
}