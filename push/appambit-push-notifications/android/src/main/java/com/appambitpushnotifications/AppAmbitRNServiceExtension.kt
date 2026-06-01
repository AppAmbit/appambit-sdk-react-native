package com.appambitpushnotifications

import android.content.Context
import android.util.Log
import com.appambit.sdk.IAppAmbitNotificationServiceExtension
import com.appambit.sdk.models.AppAmbitNotification

/**
 * Concrete implementation of [IAppAmbitNotificationServiceExtension] that acts
 * as the bridge between the AppAmbit Android Push SDK and React Native.
 *
 * Registration:
 *   Declared in the consuming app's AndroidManifest.xml as a <meta-data> entry:
 *
 *   <meta-data
 *     android:name="com.appambit.sdk.NotificationServiceExtension"
 *     android:value="com.appambitpushnotifications.AppAmbitRNServiceExtension" />
 *
 * The SDK's MessagingService reads this meta-data key and reflectively instantiates
 * this class, then calls [onNotificationForeground] or [onNotificationBackground]
 * depending on the current app state.
 *
 * Threading:
 *   Both callbacks are invoked on a background thread from within FirebaseMessagingService.
 *   The AppAmbitPushEventEmitter is thread-safe, so no synchronization is needed here.
 *
 * Background / killed state:
 *   When the app is in background or killed, [onNotificationBackground] fires.
 *   We receive the FirebaseMessagingService Context directly (always valid) and
 *   pass it to AppAmbitHeadlessService so it can start without any static holder.
 */
class AppAmbitRNServiceExtension : IAppAmbitNotificationServiceExtension {

    private val TAG = "AppAmbitRNExtension"

    // ── Abstract method implementations (no-ops) ──────────────────────────────
    // MessagingService always calls the Context-carrying overloads below.
    // These no-context variants exist solely to satisfy the interface contract.

    override fun onNotificationForeground(notification: AppAmbitNotification) = Unit

    override fun onNotificationBackground(notification: AppAmbitNotification) = Unit

    // ── Context-carrying overrides (actual implementations) ───────────────────
    // Overriding a default interface method takes full priority over the default.
    // MessagingService calls ext.onNotificationXxx(this, notification) — "this"
    // is the FirebaseMessagingService, which is a valid Context at all times,
    // even in killed state before the React Native bridge exists.

    /**
     * Called when the app is in the foreground.
     * [context] is the FirebaseMessagingService — always valid.
     */
    override fun onNotificationForeground(context: Context, notification: AppAmbitNotification) {
        Log.d(TAG, "onNotificationForeground: ${notification.title}")
        val payload = AppAmbitNotificationSerializer.toEventPayload(notification)
        AppAmbitPushEventEmitter.emit(AppAmbitPushEventEmitter.EVENT_FOREGROUND, payload)
    }

    /**
     * Called when the app is in background or killed state.
     * [context] is the FirebaseMessagingService — always valid, even before the RN bridge starts.
     */
    override fun onNotificationBackground(context: Context, notification: AppAmbitNotification) {
        Log.d(TAG, "onNotificationBackground: ${notification.title}")
        val payload = AppAmbitNotificationSerializer.toEventPayload(notification)

        // 1. Try to emit directly (works when the React host is alive in background).
        AppAmbitPushEventEmitter.emit(AppAmbitPushEventEmitter.EVENT_BACKGROUND, payload)

        // 2. Trigger Headless JS using the FirebaseMessagingService context (always valid).
        //    This starts the JS task even in killed state, without relying on any RN bridge holder.
        AppAmbitHeadlessService.enqueueNotification(context, notification)
    }
}
