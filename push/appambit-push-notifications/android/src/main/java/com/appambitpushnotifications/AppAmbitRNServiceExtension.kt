package com.appambitpushnotifications

import android.util.Log
import androidx.annotation.NonNull
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
 *   We start the AppAmbitHeadlessService, which launches a Headless JS task so that
 *   the JS background handler can execute even without a UI.
 */
class AppAmbitRNServiceExtension : IAppAmbitNotificationServiceExtension {

    private val TAG = "AppAmbitRNExtension"

    override fun onNotificationForeground(@NonNull notification: AppAmbitNotification) {
        Log.d(TAG, "onNotificationForeground: ${notification.title}")
        val payload = AppAmbitNotificationSerializer.toEventPayload(notification)
        AppAmbitPushEventEmitter.emit(AppAmbitPushEventEmitter.EVENT_FOREGROUND, payload)
    }

    override fun onNotificationBackground(@NonNull notification: AppAmbitNotification) {
        Log.d(TAG, "onNotificationBackground: ${notification.title}")
        val payload = AppAmbitNotificationSerializer.toEventPayload(notification)

        // 1. Try to emit directly (works when the React host is alive in background).
        AppAmbitPushEventEmitter.emit(AppAmbitPushEventEmitter.EVENT_BACKGROUND, payload)

        // 2. Also trigger Headless JS so the JS handler fires even in killed state.
        AppAmbitHeadlessService.enqueueNotification(notification)
    }
}
