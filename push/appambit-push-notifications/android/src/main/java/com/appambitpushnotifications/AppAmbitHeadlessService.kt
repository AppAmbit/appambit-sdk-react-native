package com.appambitpushnotifications

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.core.content.ContextCompat
import com.appambit.sdk.models.AppAmbitNotification
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * AppAmbitHeadlessService
 *
 * Launches a Headless JS task when a push notification arrives in
 * background / killed state.  Modelled after Invertase's
 * ReactNativeFirebaseMessagingHeadlessTask pattern.
 *
 * How it works:
 * 1. [AppAmbitRNServiceExtension.onNotificationBackground] calls [enqueueNotification].
 * 2. [enqueueNotification] packs the notification into an Intent and starts this Service.
 * 3. Android OS starts this Service even if the app process is dead.
 * 4. [getTaskConfig] is called by the React Native Headless machinery; we return a
 *    [HeadlessJsTaskConfig] pointing to the JS task name registered in the app.
 * 5. React Native runs the registered JS task with the notification payload.
 * 6. JS can then execute any async logic (local DB update, badge count, etc.).
 *
 * JS-side registration (the consuming app must do this in index.js / App.tsx):
 *
 *   import { AppRegistry } from 'react-native';
 *   import { BACKGROUND_NOTIFICATION_TASK } from 'appambit-push-notifications';
 *
 *   AppRegistry.registerHeadlessTask(
 *     BACKGROUND_NOTIFICATION_TASK,
 *     () => async (notification) => {
 *       console.log('Background notification received:', notification);
 *     }
 *   );
 *
 * Threading:
 *   [onHandleWork] is executed on a background thread by HeadlessJsTaskService.
 *   All React Native HeadlessJsTaskService interactions are handled by the parent class.
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
         * Starts this service and enqueues the notification payload.
         * Safe to call from any thread.
         */
        fun enqueueNotification(notification: AppAmbitNotification) {
            // We hold a static application context set at module initialisation time.
            val context = AppAmbitContextHolder.applicationContext ?: run {
                Log.e(TAG, "Application context not available — cannot start HeadlessService")
                return
            }

            if (!isAppInBackground(context)) {
                // App is in foreground: the event emitter handles it; no headless needed.
                Log.d(TAG, "App is in foreground — skipping headless task")
                return
            }

            Log.d(TAG, "Enqueueing headless task for: ${notification.title}")
            val intent = buildIntent(context, notification)
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                // On some vendors startForegroundService can throw when the process is killed.
                // Fall back to regular startService.
                try {
                    context.startService(intent)
                } catch (ex: Exception) {
                    Log.e(TAG, "Could not start HeadlessService", ex)
                }
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

        private fun isAppInBackground(context: Context): Boolean {
            val info = ActivityManager.RunningAppProcessInfo()
            ActivityManager.getMyMemoryState(info)
            return info.importance != ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
        }
    }

    // ── HeadlessJsTaskService ─────────────────────────────────────────────────

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
            /* allowedInForeground = */ true  // safe; we guard with isAppInBackground above
        )
    }
}
