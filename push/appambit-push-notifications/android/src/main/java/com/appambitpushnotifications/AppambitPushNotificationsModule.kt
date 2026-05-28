package com.appambitpushnotifications

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.activity.ComponentActivity
import com.appambit.sdk.PushKernel
import com.appambit.sdk.PushNotifications
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * AppambitPushNotificationsModule
 *
 * The Turbo Native Module that exposes AppAmbit Push SDK functionality to JavaScript.
 */
@ReactModule(name = AppambitPushNotificationsModule.NAME)
class AppambitPushNotificationsModule(reactContext: ReactApplicationContext) :
    NativeAppambitPushNotificationsSpec(reactContext), ActivityEventListener, LifecycleEventListener {

    companion object {
        const val NAME = "AppambitPushNotifications"
        private const val TAG = "AppAmbitPushModule"

        // SharedPreferences for offline-resilient consumer sync
        private const val PUSH_PREFS = "appambit_push_prefs"
        private const val KEY_HAS_PENDING = "appambit_push_has_pending"
        private const val KEY_PENDING_ENABLED = "appambit_push_pending_enabled"
    }

    private var hasRegisteredOpenedListener = false
    private var lastProcessedIntent: Intent? = null

    // Offline retry state
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private val retryHandler = Handler(Looper.getMainLooper())

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun getName(): String = NAME

    override fun initialize() {
        super.initialize()
        Log.d(TAG, "Module initialized")
        AppAmbitContextHolder.set(reactApplicationContext)
        AppAmbitPushEventEmitter.attach(reactApplicationContext)

        reactApplicationContext.addActivityEventListener(this)
        reactApplicationContext.addLifecycleEventListener(this)

        // Try to check intent immediately if activity exists
        checkInitialIntent()
    }

    override fun invalidate() {
        cancelOfflineRetry()
        AppAmbitPushEventEmitter.detach()
        PushKernel.setOpenedNotificationListener(null)
        reactApplicationContext.removeActivityEventListener(this)
        reactApplicationContext.removeLifecycleEventListener(this)
        hasRegisteredOpenedListener = false
        super.invalidate()
    }

    private fun checkInitialIntent() {
        val activity = currentActivity
        Log.d(TAG, "checkInitialIntent called. activity=$activity")

        if (activity != null) {
            var intent = activity.intent
            Log.d(TAG, "checkInitialIntent: intent=$intent, lastProcessedIntent=$lastProcessedIntent")

            if (intent != null && intent != lastProcessedIntent) {
                lastProcessedIntent = intent

                Log.d(TAG, "checkInitialIntent: original action=${intent.action}")
                val extras = intent.extras

                if (extras != null && intent.action != "com.appambit.sdk.NOTIFICATION_OPENED") {
                    var isPush = extras.containsKey("google.message_id")
                    for (key in extras.keySet()) {
                        Log.d(TAG, "checkInitialIntent: extra $key = ${extras.get(key)}")
                        if (key.startsWith("gcm.")) {
                            isPush = true
                        }
                    }

                    if (isPush) {
                        Log.d(TAG, "checkInitialIntent: Detected FCM System Tray Intent. Mutating format...")
                        val pushIntent = Intent(intent)
                        pushIntent.action = "com.appambit.sdk.NOTIFICATION_OPENED"

                        val title = extras.getString("gcm.notification.title") ?: extras.getString("title")
                        val body  = extras.getString("gcm.notification.body")  ?: extras.getString("body")
                        if (title != null) pushIntent.putExtra("appambit_title", title)
                        if (body  != null) pushIntent.putExtra("appambit_body",  body)

                        // imageUrl: gcm.notification.image is filtered from the data loop below,
                        // so we extract it explicitly here.
                        val imageUrl = extras.getString("gcm.notification.image")
                            ?: extras.getString("image_url")
                            ?: extras.getString("image")
                        if (imageUrl != null) pushIntent.putExtra("appambit_image_url", imageUrl)

                        // color and icon
                        val color = extras.getString("gcm.notification.color")
                        val icon  = extras.getString("gcm.notification.icon")
                        if (color != null) pushIntent.putExtra("appambit_color", color)
                        if (icon  != null) pushIntent.putExtra("appambit_icon",  icon)

                        val keysList   = mutableListOf<String>()
                        val valuesList = mutableListOf<String>()

                        // Inject Android notification display fields as _aa_* data keys so the
                        // serializer can promote them into the android sub-object and strip them
                        // from the custom data map exposed to JS.
                        mapOf(
                            "_aa_ticker"       to (extras.getString("gcm.notification.ticker")),
                            "_aa_sticky"       to (extras.getString("gcm.notification.sticky")),
                            "_aa_visibility"   to (extras.getString("gcm.notification.visibility")),
                            "_aa_channel_id"   to (extras.getString("gcm.notification.channel_id")),
                            "_aa_priority"     to (extras.getString("gcm.notification.priority")
                                                   ?: extras.getString("gcm.notification.notification_priority")),
                            "_aa_tag"          to (extras.getString("gcm.notification.tag")),
                            "_aa_sound"        to (extras.getString("gcm.notification.sound")),
                            "_aa_click_action" to (extras.getString("gcm.notification.click_action")
                                                   ?: extras.getString("gcm.notification.clickAction"))
                        ).forEach { (key, value) ->
                            if (value != null) { keysList.add(key); valuesList.add(value) }
                        }

                        // Custom data keys from the FCM data payload
                        for (key in extras.keySet()) {
                            if (!key.startsWith("google.") && !key.startsWith("gcm.") && !key.startsWith("android.") &&
                                key != "from" && key != "collapse_key" && key != "profile") {
                                keysList.add(key)
                                valuesList.add(extras.get(key).toString())
                            }
                        }

                        if (keysList.isNotEmpty()) {
                            pushIntent.putExtra("appambit_data_keys",        keysList.toTypedArray())
                            pushIntent.putExtra("appambit_data_keys_values", valuesList.toTypedArray())
                        }

                        intent = pushIntent
                    }
                } else if (extras == null) {
                    Log.d(TAG, "checkInitialIntent: no extras")
                }

                PushNotifications.handleNotificationOpened(reactApplicationContext.applicationContext, intent)
            }
        }
    }

    // ── LifecycleEventListener ────────────────────────────────────────────────

    override fun onHostResume() {
        // This handles the case where the React bridge was started in the background
        // by a Headless task, and then the user tapped the notification.
        // initialize() was already called when currentActivity was null.
        // Now onHostResume is called and currentActivity is available!
        checkInitialIntent()
    }

    override fun onHostPause() {
        // No-op
    }

    override fun onHostDestroy() {
        // No-op
    }

    // ── ActivityEventListener ─────────────────────────────────────────────────

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        // No-op
    }

    override fun onNewIntent(intent: Intent) {
        if (intent != lastProcessedIntent) {
            lastProcessedIntent = intent
            Log.d(TAG, "onNewIntent: action=${intent.action}")
            PushNotifications.handleNotificationOpened(reactApplicationContext.applicationContext, intent)
        }
    }

    // ── JS API ────────────────────────────────────────────────────────────────

    override fun start() {
        checkInitialIntent()
        // Replay any pending enabled/disabled state that failed to sync while offline.
        // Must run before PushNotifications.start() so the correct state is in place
        // before the token listener and initial consumer sync run.
        flushPendingSyncIfNeeded()
        PushNotifications.start(reactApplicationContext.applicationContext)
    }

    override fun requestNotificationPermission() {
        val activity: Activity? = currentActivity
        if (activity is ComponentActivity) {
            PushNotifications.requestNotificationPermission(activity)
        } else {
            Log.w(TAG, "requestNotificationPermission: currentActivity is not a ComponentActivity")
        }
    }

    override fun requestNotificationPermissionWithResult(promise: Promise) {
        val activity: Activity? = currentActivity
        if (activity is ComponentActivity) {
            PushNotifications.requestNotificationPermission(activity) { isGranted ->
                promise.resolve(isGranted)
            }
        } else {
            promise.resolve(false)
        }
    }

    override fun setNotificationsEnabled(enabled: Boolean) {
        val context = reactApplicationContext.applicationContext
        // Persist intent immediately so it survives process death and app restarts.
        savePendingSync(context, enabled)
        // Optimistic attempt — succeeds online, fails silently offline.
        PushNotifications.setNotificationsEnabled(context, enabled)
        // Register a connectivity callback to retry as soon as the network returns.
        scheduleOfflineRetry(context)
    }

    override fun isNotificationsEnabled(promise: Promise) {
        val enabled = PushNotifications.isNotificationsEnabled(
            reactApplicationContext.applicationContext
        )
        promise.resolve(enabled)
    }

    override fun hasNotificationPermission(promise: Promise) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactApplicationContext.checkSelfPermission(
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        promise.resolve(granted)
    }

    override fun backgroundHandlerCompleted() {
        // Android background execution is managed by the headless JS task registered with
        // BACKGROUND_NOTIFICATION_TASK — no native completion signal needed here.
    }

    // ── Required by NativeEventEmitter ───────────────────────────────────────

    override fun addListener(eventName: String?) {
        if (eventName == AppAmbitPushEventEmitter.EVENT_OPENED && !hasRegisteredOpenedListener) {
            hasRegisteredOpenedListener = true
            registerOpenedListener()
        }
    }

    override fun removeListeners(count: Double) {
        // No-op
    }

    // ── Offline-resilient consumer sync ──────────────────────────────────────

    /**
     * Persists the desired enabled state so it survives process death.
     * Cleared only by the connectivity callback after a successful retry.
     */
    private fun savePendingSync(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_HAS_PENDING, true)
            .putBoolean(KEY_PENDING_ENABLED, enabled)
            .apply()
    }

    private fun clearPendingSync(context: Context) {
        context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_HAS_PENDING, false)
            .apply()
    }

    /**
     * Called from start() to replay a pending sync that was not delivered in a
     * previous session (e.g. user toggled while offline, then the app was killed).
     */
    private fun flushPendingSyncIfNeeded() {
        val context = reactApplicationContext.applicationContext
        val prefs = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_HAS_PENDING, false)) return
        val enabled = prefs.getBoolean(KEY_PENDING_ENABLED, true)
        Log.d(TAG, "flushPendingSyncIfNeeded: replaying enabled=$enabled")
        PushNotifications.setNotificationsEnabled(context, enabled)
        // Keep the pending flag set; the ConnectivityManager callback clears it once
        // the device has connectivity, guaranteeing at least one confirmed delivery.
        scheduleOfflineRetry(context)
    }

    /**
     * Registers a one-shot ConnectivityManager callback that retries the consumer
     * sync as soon as an internet-capable network is available.
     */
    private fun scheduleOfflineRetry(context: Context) {
        cancelOfflineRetry()
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                val prefs = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
                if (!prefs.getBoolean(KEY_HAS_PENDING, false)) {
                    cancelOfflineRetry()
                    return
                }
                val pendingEnabled = prefs.getBoolean(KEY_PENDING_ENABLED, true)
                Log.d(TAG, "Network available — retrying setNotificationsEnabled=$pendingEnabled")
                retryHandler.post {
                    PushNotifications.setNotificationsEnabled(context, pendingEnabled)
                    clearPendingSync(context)
                    cancelOfflineRetry()
                }
            }
        }
        networkCallback = cb
        cm.registerNetworkCallback(
            NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build(),
            cb
        )
    }

    private fun cancelOfflineRetry() {
        retryHandler.removeCallbacksAndMessages(null)
        networkCallback?.let { cb ->
            try {
                (reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE)
                    as ConnectivityManager).unregisterNetworkCallback(cb)
            } catch (_: Exception) { /* already unregistered */ }
            networkCallback = null
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private fun registerOpenedListener() {
        PushNotifications.setOpenedListener { notification ->
            Log.d(TAG, "Notification opened: ${notification.title}")
            val payload = AppAmbitNotificationSerializer.toEventPayload(notification)
            AppAmbitPushEventEmitter.emit(AppAmbitPushEventEmitter.EVENT_OPENED, payload)
        }
    }
}
