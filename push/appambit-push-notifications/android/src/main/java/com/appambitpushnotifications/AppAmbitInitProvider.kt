package com.appambitpushnotifications

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.util.Log

/**
 * AppAmbitInitProvider — early-initialisation ContentProvider.
 *
 * Android starts ContentProviders BEFORE [Application.onCreate], which makes them
 * the only reliable way to obtain an [android.app.Application] context at process
 * startup — even when the process is created solely to handle an FCM message (killed state).
 *
 * This provider sets [AppAmbitContextHolder.applicationContext] at the earliest possible
 * moment so that any component in the SDK can rely on it without waiting for the React
 * Native bridge to initialise.
 *
 * This is the exact same pattern used by:
 *   - Firebase (FirebaseInitProvider)
 *   - WorkManager (WorkManagerInitializer)
 *   - OneSignal (OneSignalSyncServiceUtils)
 *
 * Registration:
 *   Declared automatically in the SDK's AndroidManifest.xml (merged into the host app):
 *
 *   <provider
 *       android:name="com.appambitpushnotifications.AppAmbitInitProvider"
 *       android:authorities="${applicationId}.appambit-init-provider"
 *       android:exported="false"
 *       android:initOrder="100" />
 *
 * No action is required from the consumer app.
 */
internal class AppAmbitInitProvider : ContentProvider() {

    private val TAG = "AppAmbitInitProvider"

    override fun onCreate(): Boolean {
        val appContext = context?.applicationContext
        if (appContext == null) {
            Log.e(TAG, "Context is null during ContentProvider.onCreate — cannot initialise AppAmbitContextHolder")
            return false
        }
        AppAmbitContextHolder.set(appContext)
        Log.d(TAG, "AppAmbitContextHolder initialised early via ContentProvider")
        return true
    }

    // ── Required ContentProvider stubs (this provider serves no data) ─────────

    override fun query(
        uri: Uri,
        projection: Array<String>?,
        selection: String?,
        selectionArgs: Array<String>?,
        sortOrder: String?
    ): Cursor? = null

    override fun getType(uri: Uri): String? = null

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<String>?
    ): Int = 0
}
