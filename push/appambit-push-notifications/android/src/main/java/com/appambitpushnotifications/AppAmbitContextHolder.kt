package com.appambitpushnotifications

import android.content.Context

/**
 * Holds a reference to the Application context so that the
 * [AppAmbitHeadlessService] can start itself even when no Activity is alive
 * (killed state / background).
 *
 * Set once in [AppambitPushNotificationsModule.initialize] via the
 * ReactApplicationContext, which outlives individual activities.
 */
internal object AppAmbitContextHolder {
    @Volatile
    var applicationContext: Context? = null
        private set

    fun set(context: Context) {
        applicationContext = context.applicationContext
    }
}
