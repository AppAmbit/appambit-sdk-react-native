package com.appambitpushnotifications

import com.appambit.sdk.MessagingService
import com.google.firebase.messaging.RemoteMessage

class AppAmbitMessagingService : MessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        AppAmbitRemoteMessageStore.set(remoteMessage)
        super.onMessageReceived(remoteMessage)
    }
}
