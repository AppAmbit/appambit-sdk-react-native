import { useState, useEffect } from "react";
import { ScrollView, Text, Alert, View, ActivityIndicator } from "react-native";
import { uuidv4 } from "../utils/uuid";

import {
  didCrashInLastSession,
  setUserId,
  setUserEmail,
  generateTestCrash,
  logError,
  logErrorMessage,
} from "appambit";
import CustomInput from "../components/CustomInput";
import CustomButton from "../components/CustomButton";
import * as PushNotifications from "appambit-push-notifications";

export default function CrashesScreen() {
  const [userId] = useState<string>(uuidv4());
  const [hasPermission, setHasPermission] = useState(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkNotificationState = async () => {
      try {
        const [permission, enabled] = await Promise.all([
          PushNotifications.hasNotificationPermission(),
          PushNotifications.isNotificationsEnabled(),
        ]);

        if (!isMounted) {
          return;
        }

        setHasPermission(permission);
        setNotificationsEnabledState(enabled);
      } catch (error) {
        console.warn("[CrashesScreen] Failed to read notification state", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkNotificationState();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, fontSize: 16 }}>Loading Crashes screen...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", paddingVertical: 20 }}>
      <View style={{ height: 30 }} />
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>Crashes</Text>
      <View style={{ height: 30 }} />

      <CustomButton
        title={!hasPermission ? "Allow notifications" : notificationsEnabled ? "Disable notifications" : "Enable notifications"}
        onPress={async () => {
          if (!hasPermission) {
            const granted =
              await PushNotifications.requestNotificationPermissionWithResult();

            if (!granted) {
              return;
            }

            setHasPermission(true);
            await PushNotifications.setNotificationsEnabled(true);
            setNotificationsEnabledState(true);
            return;
          }

          if (notificationsEnabled) {
            PushNotifications.setNotificationsEnabled(false);
            setNotificationsEnabledState(false);
          } else {
            PushNotifications.setNotificationsEnabled(true);
            setNotificationsEnabledState(true);
          }
        }}
      />

      <CustomButton
        title="Did the app crash during your last session?"
        onPress={async () => {
          const result = await didCrashInLastSession();
          Alert.alert("Info", result ? "Application did crash in the last session" : "Application did not crash in the last session")
        }}
      />

      <CustomInput
        placeholder="Enter User ID"
        buttonLabel="Change user id"
        defaultValue={userId}
        onSubmit={(value) => {
            setUserId(value)
            Alert.alert("Info", "User id changed")
        }}
      />

      <CustomInput
        placeholder="test@gmail.com"
        buttonLabel="Change user email"
        defaultValue="test@gmail.com"
        onSubmit={(value) => {
            setUserEmail(value)
            Alert.alert("Info", "User email changed")
        }}
      />

      <CustomInput
        placeholder="Test Log Message"
        buttonLabel="Send Custom LogError"
        defaultValue="Test Log Message"
        onSubmit={(value) => {
            logErrorMessage(value)
            Alert.alert("Info", "LogError sent")
        }}
      />

      <CustomButton title="Send Exception LogError"
        onPress={() => {
            try {
              throw new Error();
            } catch (e : any) {
              logError(
                { stack: e.stack, exception: e, classFqn: e.constructor.name },
              );
              Alert.alert("Info", "LogError sent" );
            }
      }} />

      <CustomButton title="Throw new Crash"
        onPress={() => {
            Alert.alert("Info", "LogError sent");
            throw new Error("Test Crash");
        }
      } />

      <CustomButton title="Generate Test Crash"
        onPress={() => {
            generateTestCrash();
        }
      } />
    </ScrollView>
  );
}