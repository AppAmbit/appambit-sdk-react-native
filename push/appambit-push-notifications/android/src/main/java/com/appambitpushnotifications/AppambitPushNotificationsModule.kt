package com.appambitpushnotifications

import android.app.Activity
import android.util.Log
import androidx.activity.ComponentActivity
import com.appambit.sdk.PushKernel
import com.appambit.sdk.PushNotifications
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * AppambitPushNotificationsModule
 *
 * The Turbo Native Module that exposes AppAmbit Push SDK functionality to JavaScript.
 *
 * Architecture overview:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  JavaScript (index.tsx)                                          │
 * │   AppAmbitPush.setForegroundNotificationListener(fn)             │
 * │   AppAmbitPush.setBackgroundNotificationListener(fn)             │
 * │   AppAmbitPush.setOpenedNotificationListener(fn)                 │
 * └────────────────────────────┬─────────────────────────────────────┘
 *                              │  DeviceEventEmitter
 * ┌────────────────────────────▼─────────────────────────────────────┐
 * │  AppambitPushNotificationsModule (this file)                     │
 * │   • Bridges JS calls to PushKernel / PushNotifications           │
 * │   • Registers foreground/opened listeners on PushKernel          │
 * └────────────────────────────┬─────────────────────────────────────┘
 *                              │
 * ┌────────────────────────────▼─────────────────────────────────────┐
 * │  AppAmbitRNServiceExtension (IAppAmbitNotificationServiceExtension)│
 * │   • Receives callbacks from MessagingService (Android push SDK)  │
 * │   • Foreground → emit EVENT_FOREGROUND                           │
 * │   • Background → emit EVENT_BACKGROUND + start HeadlessService   │
 * └────────────────────────────┬─────────────────────────────────────┘
 *                              │
 * ┌────────────────────────────▼─────────────────────────────────────┐
 * │  AppAmbitHeadlessService (HeadlessJsTaskService)                 │
 * │   • Starts JS Headless task even when app is killed              │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Lifecycle:
 * - initialize()  → called by RN once the bridge is ready (replaces old onCatalystInstanceDestroy)
 * - invalidate()  → called when the module is torn down (hot reload / process death)
 */
@ReactModule(name = AppambitPushNotificationsModule.NAME)
class AppambitPushNotificationsModule(reactContext: ReactApplicationContext) :
    NativeAppambitPushNotificationsSpec(reactContext) {

    companion object {
        const val NAME = "AppambitPushNotifications"
        private const val TAG = "AppAmbitPushModule"
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun getName(): String = NAME

    /**
     * Called by RN once the bridge / Turbo registry is up.
     * We take this opportunity to:
     *  1. Store the app context for background use.
     *  2. Attach the emitter so queued events are drained.
     *  3. Register the opened-notification listener on PushKernel.
     */
    override fun initialize() {
        super.initialize()
        Log.d(TAG, "Module initialized")
        AppAmbitContextHolder.set(reactApplicationContext)
        AppAmbitPushEventEmitter.attach(reactApplicationContext)
        registerOpenedListener()
    }

    override fun invalidate() {
        AppAmbitPushEventEmitter.detach()
        PushKernel.setOpenedNotificationListener(null)
        super.invalidate()
    }

    // ── JS API ────────────────────────────────────────────────────────────────

    override fun start() {
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

    /**
     * setNotificationCustomizer — legacy method kept for backward compat.
     * The new API uses setForegroundNotificationListener instead.
     */
    override fun setNotificationCustomizer() {
        // Intentionally left as a no-op: the new listener-based API supersedes this.
        // Foreground notifications are routed via AppAmbitRNServiceExtension → EVENT_FOREGROUND.
        Log.d(TAG, "setNotificationCustomizer called (no-op — use setForegroundNotificationListener)")
    }

    // ── Required by NativeEventEmitter ───────────────────────────────────────

    override fun addListener(eventName: String?) {
        // No-op: React Native requires this method to exist on the native side
        // when using NativeEventEmitter. Listener management is done in JS.
    }

    override fun removeListeners(count: Double) {
        // No-op: same as above.
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Registers a PushKernel.OpenedNotificationListener that converts the
     * native AppAmbitNotification into a WritableMap and emits it to JS.
     *
     * This handles all three opened scenarios:
     *  - App in foreground: direct emit via active React instance
     *  - App in background: event queued then drained when JS is ready
     *  - Cold start: event queued in AppAmbitPushEventEmitter until bridge attaches
     */
    private fun registerOpenedListener() {
        PushNotifications.setOpenedListener { notification ->
            Log.d(TAG, "Notification opened: ${notification.title}")
            val payload = AppAmbitNotificationSerializer.toEventPayload(notification)
            AppAmbitPushEventEmitter.emit(AppAmbitPushEventEmitter.EVENT_OPENED, payload)
        }
    }
}