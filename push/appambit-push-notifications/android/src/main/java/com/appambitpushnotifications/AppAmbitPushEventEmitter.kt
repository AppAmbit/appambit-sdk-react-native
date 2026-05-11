package com.appambitpushnotifications

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Thread-safe event emitter for the AppAmbit Push SDK.
 *
 * Design goals:
 * 1. Never crash if ReactContext is not yet initialized (e.g. cold start).
 * 2. Queue events that arrive before JS is ready and drain them once the
 *    bridge is up.
 * 3. Provide a single place to route all native→JS events so that the
 *    Module, the HeadlessTask, and the ServiceExtension all emit through
 *    the same channel.
 */
internal object AppAmbitPushEventEmitter {

    private const val TAG = "AppAmbitEmitter"

    // Events used by the SDK — kept here to avoid magic strings everywhere.
    const val EVENT_FOREGROUND  = "AppAmbit_onForegroundNotification"
    const val EVENT_BACKGROUND  = "AppAmbit_onBackgroundNotification"
    const val EVENT_OPENED      = "AppAmbit_onOpenedNotification"

    @Volatile
    private var reactContext: ReactApplicationContext? = null

    // Queue for events that arrive before the React bridge is ready.
    private val eventQueue = CopyOnWriteArrayList<Pair<String, WritableMap>>()

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /**
     * Called once the TurboModule is instantiated.
     * Drains the queue of any events that arrived before JS was ready.
     */
    fun attach(context: ReactApplicationContext) {
        reactContext = context
        Log.d(TAG, "ReactContext attached — draining ${eventQueue.size} queued events")
        val iter = eventQueue.iterator()
        while (iter.hasNext()) {
            val (event, payload) = iter.next()
            dispatchToJS(event, payload)
        }
        eventQueue.clear()
    }

    /**
     * Called when the module is invalidated (e.g. hot reload or app restart).
     */
    fun detach() {
        reactContext = null
        eventQueue.clear()
    }

    // ── Emission ─────────────────────────────────────────────────────────────

    /**
     * Emit an event. If the React bridge is ready the event is delivered
     * immediately; otherwise it is queued until [attach] is called.
     */
    fun emit(eventName: String, payload: WritableMap) {
        if (!dispatchToJS(eventName, payload)) {
            Log.d(TAG, "Bridge not ready — queuing event: $eventName")
            eventQueue.add(eventName to payload)
        }
    }

    /**
     * Returns true if the event was emitted, false if the bridge was not available.
     */
    private fun dispatchToJS(eventName: String, payload: WritableMap): Boolean {
        val ctx = reactContext ?: return false
        return try {
            if (ctx.hasActiveReactInstance()) {
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(eventName, payload)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit event $eventName", e)
            false
        }
    }
}
