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
import android.util.Log
import androidx.activity.ComponentActivity
import com.appambit.sdk.AppAmbit
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

        // SharedPreferences for UI state persistence across restarts.
        private const val PUSH_PREFS = "appambit_push_prefs"
        private const val KEY_ENABLED_STATE = "appambit_push_enabled_state"
        private const val KEY_HAS_ENABLED_STATE = "appambit_push_has_enabled_state"
        // Pending consumer-sync intent: last toggle not yet confirmed online.
        private const val KEY_PENDING = "appambit_push_pending_sync"
        private const val KEY_PENDING_VALUE = "appambit_push_pending_value"
    }

    private var hasRegisteredOpenedListener = false
    private var lastProcessedIntent: Intent? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun getName(): String = NAME

    override fun initialize() {
        super.initialize()
        Log.d(TAG, "Module initialized")
        AppAmbitContextHolder.set(reactApplicationContext)
        AppAmbitPushEventEmitter.attach(reactApplicationContext)

        reactApplicationContext.addActivityEventListener(this)
        reactApplicationContext.addLifecycleEventListener(this)

        registerNetworkCallback()

        // Try to check intent immediately if activity exists
        checkInitialIntent()
    }

    override fun invalidate() {
        AppAmbitPushEventEmitter.detach()
        PushKernel.setOpenedNotificationListener(null)
        reactApplicationContext.removeActivityEventListener(this)
        reactApplicationContext.removeLifecycleEventListener(this)
        unregisterNetworkCallback()
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
        checkInitialIntent()
        // Replay any deferred consumer sync (covers "toggle offline → reopen online").
        flushPendingConsumerSync()
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
        PushNotifications.start(reactApplicationContext.applicationContext)
        // start() is invoked from JS right after AppAmbit.start() (Core init), so this
        // is the first reliable point where a deferred consumer sync can succeed.
        // onHostResume / the network callback may fire before Core is initialized.
        flushPendingConsumerSync()
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
        val prefs = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
        // 1. Persist user intent for UI state consistency across restarts and
        //    2. record a pending consumer-sync intent (cleared once delivered).
        prefs.edit()
            .putBoolean(KEY_ENABLED_STATE, enabled)
            .putBoolean(KEY_HAS_ENABLED_STATE, true)
            .putBoolean(KEY_PENDING_VALUE, enabled)
            .putBoolean(KEY_PENDING, true)
            .apply()
        // 3. Update the SDK's local enabled flag (no network) so cold-start token
        //    sync knows the user's intent.
        PushKernel.setNotificationsEnabled(context, enabled)
        // 4. Push to the backend when online; otherwise defer until connectivity
        //    returns (replayed from the network callback / onHostResume).
        flushPendingConsumerSync()
    }

    override fun isNotificationsEnabled(promise: Promise) {
        val context = reactApplicationContext.applicationContext
        val prefs = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_HAS_ENABLED_STATE, false)) {
            // Return our own persisted state — always the last value the user explicitly set,
            // survives cold restarts and SDK state inconsistencies.
            promise.resolve(prefs.getBoolean(KEY_ENABLED_STATE, false))
        } else {
            // First-ever launch: no stored state yet, ask the SDK.
            promise.resolve(
                PushNotifications.isNotificationsEnabled(context)
            )
        }
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
    // The SDK's consumer update is fire-and-forget with no offline retry, so we
    // defer it while offline and replay it when connectivity returns.

    private fun registerNetworkCallback() {
        if (networkCallback != null) return
        val cm = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE)
            as? ConnectivityManager ?: return
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "NetworkCallback.onAvailable")
                flushPendingConsumerSync()
            }

            override fun onCapabilitiesChanged(
                network: Network,
                caps: NetworkCapabilities
            ) {
                // onAvailable can fire before the link is actually usable; the
                // capabilities update is a second chance to replay once the
                // network reports INTERNET.
                if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                    flushPendingConsumerSync()
                }
            }
        }
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        try {
            cm.registerNetworkCallback(request, callback)
            networkCallback = callback
        } catch (e: Exception) {
            Log.w(TAG, "registerNetworkCallback failed: ${e.message}")
        }
    }

    private fun unregisterNetworkCallback() {
        val cb = networkCallback ?: return
        val cm = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE)
            as? ConnectivityManager
        try {
            cm?.unregisterNetworkCallback(cb)
        } catch (e: Exception) {
            Log.w(TAG, "unregisterNetworkCallback failed: ${e.message}")
        }
        networkCallback = null
    }

    private fun isNetworkAvailable(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE)
            as? ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        // Only require INTERNET capability (matches iOS NWPathMonitor's `.satisfied`).
        // We intentionally do NOT require NET_CAPABILITY_VALIDATED: emulators and
        // freshly-reconnected networks often report a usable connection before (or
        // without ever) flipping VALIDATED, which would otherwise make the deferred
        // consumer sync skip forever.
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    @Synchronized
    private fun flushPendingConsumerSync() {
        val context = reactApplicationContext.applicationContext
        val prefs = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_PENDING, false)) return
        if (!isNetworkAvailable(context)) {
            Log.d(TAG, "flushPendingConsumerSync: offline, keeping pending intent")
            return
        }
        // The Core SDK rejects (and logs) any consumer update before AppAmbit.start()
        // has run. onHostResume / the network callback can fire during cold start
        // BEFORE the JS layer initializes Core, so we must keep the pending intent
        // until Core is ready — otherwise the replay is silently dropped.
        if (!AppAmbit.isInitialized()) {
            Log.d(TAG, "flushPendingConsumerSync: Core not initialized yet, keeping pending intent")
            return
        }
        val desired = prefs.getBoolean(KEY_PENDING_VALUE, false)
        Log.d(TAG, "flushPendingConsumerSync: replaying consumer update enabled=$desired")
        // The SDK's consumer update reuses the last stored device token when no
        // live token is available, so this succeeds as long as a token was ever
        // registered (it only skips when nothing has ever been stored).
        PushNotifications.setNotificationsEnabled(context, desired)
        prefs.edit()
            .remove(KEY_PENDING)
            .remove(KEY_PENDING_VALUE)
            .apply()
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
