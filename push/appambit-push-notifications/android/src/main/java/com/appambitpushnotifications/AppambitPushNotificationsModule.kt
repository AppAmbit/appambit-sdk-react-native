package com.appambitpushnotifications

import android.app.Activity
import android.content.Intent
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
    }

    private var hasRegisteredOpenedListener = false
    private var lastProcessedIntent: Intent? = null

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
        PushNotifications.setNotificationsEnabled(
            reactApplicationContext.applicationContext,
            enabled
        )
    }

    override fun isNotificationsEnabled(promise: Promise) {
        val enabled = PushNotifications.isNotificationsEnabled(
            reactApplicationContext.applicationContext
        )
        promise.resolve(enabled)
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

    // ── Internal helpers ──────────────────────────────────────────────────────

    private fun registerOpenedListener() {
        PushNotifications.setOpenedListener { notification ->
            Log.d(TAG, "Notification opened: ${notification.title}")
            val payload = AppAmbitNotificationSerializer.toEventPayload(notification)
            AppAmbitPushEventEmitter.emit(AppAmbitPushEventEmitter.EVENT_OPENED, payload)
        }
    }
}