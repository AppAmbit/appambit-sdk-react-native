import { useState } from "react";
import { ScrollView, Text, Alert, View } from "react-native";
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
import * as AppAmbitPushNotifications from "appambit-push-notifications";

export default function CrashesScreen() {
  const [userId] = useState<string>(uuidv4());
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", paddingVertical: 20 }}>
      <View style={{ height: 30 }} />
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>Crashes</Text>
      <View style={{ height: 30 }} />

      <CustomButton
      title={
        notificationsEnabled
          ? 'Disable Notifications'
          : 'Allow Notifications'
      }
      onPress={async () => {
        AppAmbitPushNotifications.requestNotificationPermission();
        const newValue = !notificationsEnabled;

        AppAmbitPushNotifications.setNotificationsEnabled(newValue);
        setNotificationsEnabledState(newValue);
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