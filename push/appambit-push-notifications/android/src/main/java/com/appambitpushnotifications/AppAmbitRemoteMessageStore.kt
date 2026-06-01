package com.appambitpushnotifications

import com.google.firebase.messaging.RemoteMessage
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

internal object AppAmbitRemoteMessageStore {

    private val stored   = AtomicReference<RemoteMessage?>(null)
    private val storedAt = AtomicLong(0L)
    private const val TTL_MS = 60_000L

    fun set(message: RemoteMessage) {
        stored.set(message)
        storedAt.set(System.currentTimeMillis())
    }

    fun get(): RemoteMessage? {
        val msg = stored.get() ?: return null
        if (System.currentTimeMillis() - storedAt.get() > TTL_MS) {
            stored.set(null)
            return null
        }
        return msg
    }
}
