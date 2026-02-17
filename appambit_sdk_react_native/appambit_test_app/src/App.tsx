import { useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import * as AppAmbit from "appambit";
//import * as PushNotifications from "appambit-push-notifications";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { registerNavigationTracking } from "appambit";

import CrashesScreen from "./screens/CrashesScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import RemoteConfigScreen from "./screens/RemoteConfigScreen";
import SecondScreen from "./screens/SecondScreen";

type RootStackParamList = {
  HomeScreen: undefined;
  SecondScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen() {
  const [activeTab, setActiveTab] = useState<"Crashes" | "Analytics" | "RemoteConfig">("Crashes");

  // PushNotifications.setNotificationCustomizer((payload: PushNotifications.NotificationPayload) => {
  //   console.log("Customizer received payload:", payload);
  //   console.log("Customizer received data:", payload.data);
  //   console.log("Customizer received title:", payload.notification?.title);
  //   console.log("Customizer received body:", payload.notification?.body);
  // });
  // PushNotifications.start();

  return (
    <View style={{ flex: 1 }}>
      {activeTab === "Crashes" && <CrashesScreen />}
      {activeTab === "Analytics" && <AnalyticsScreen />}
      {activeTab === "RemoteConfig" && <RemoteConfigScreen />}

      <View style={styles.bottomNav}>
        <Pressable
          style={[styles.navButton, activeTab === "Crashes" && styles.activeTab]}
          onPress={() => setActiveTab("Crashes")}
        >
          <Text style={styles.navText}>Crashes</Text>
        </Pressable>

        <Pressable
          style={[styles.navButton, activeTab === "Analytics" && styles.activeTab]}
          onPress={() => setActiveTab("Analytics")}
        >
          <Text style={styles.navText}>Analytics</Text>
        </Pressable>

        <Pressable
          style={[styles.navButton, activeTab === "RemoteConfig" && styles.activeTab]}
          onPress={() => setActiveTab("RemoteConfig")}
        >
          <Text style={styles.navText}>Remote Config</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function App() {
  const navigationRef = useNavigationContainerRef();

  //AppAmbit.enableManualSession();
  AppAmbit.enableRemoteConfig();
  AppAmbit.start("31c5d550-0ac9-46fe-b33b-144a5ab25215");

  return (
      <NavigationContainer 
        ref={navigationRef}
        onReady={() => {
          registerNavigationTracking(navigationRef);
        }}>
        <Stack.Navigator screenOptions={{ headerShown: true }}>
          <Stack.Screen name="HomeScreen" component={HomeScreen} />
          <Stack.Screen name="SecondScreen" component={SecondScreen} />
        </Stack.Navigator>
      </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    height: 65,
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#CCC",
    backgroundColor: "#F7F7F7",
  },
  navButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  activeTab: {
    backgroundColor: "#E6E6E6",
  },
  navText: {
    fontSize: 16,
    fontWeight: "600",
  },
});