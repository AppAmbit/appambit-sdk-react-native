import { useEffect, useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import * as AppAmbit from "appambit";
import * as PushNotifications from "appambit-push-notifications";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { registerNavigationTracking } from "appambit";

import CrashesScreen from "./screens/CrashesScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import RemoteConfigScreen from "./screens/RemoteConfigScreen";
import CmsScreen from "./screens/CmsScreen";
import PushNotificationScreen from "./screens/PushNotificationScreen";
import SecondScreen from "./screens/SecondScreen";

type RootStackParamList = {
  HomeScreen: undefined;
  SecondScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen() {
  const [activeTab, setActiveTab] = useState<"Crashes" | "Analytics" | "RemoteConfig" | "CMS" | "Push">("Crashes");

  return (
    <View style={{ flex: 1 }}>
      {activeTab === "Crashes" && <CrashesScreen />}
      {activeTab === "Analytics" && <AnalyticsScreen />}
      {activeTab === "RemoteConfig" && <RemoteConfigScreen />}
      {activeTab === "CMS" && <CmsScreen />}
      {activeTab === "Push" && <PushNotificationScreen />}

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
          <Text style={styles.navText}>Config</Text>
        </Pressable>

        <Pressable
          style={[styles.navButton, activeTab === "CMS" && styles.activeTab]}
          onPress={() => setActiveTab("CMS")}
        >
          <Text style={styles.navText}>CMS</Text>
        </Pressable>

        <Pressable
          style={[styles.navButton, activeTab === "Push" && styles.activeTab]}
          onPress={() => setActiveTab("Push")}
        >
          <Text style={styles.navText}>Push</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function App() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  AppAmbit.enableConfig();
  AppAmbit.start("e39f05cf-1dc3-4f1b-b12a-7118867a8a5e");
  PushNotifications.start();

  useEffect(() => {
    // Foreground: notification received while app is open
    const removeForeground = PushNotifications.setForegroundListener(
      async (payload: PushNotifications.NotificationPayload) => {
        console.log("[AppAmbit] Foreground notification received");
        console.log("  title:", payload.notification.title);
        console.log("  body:", payload.notification.body);
        console.log("  data:", payload.notification.data);
      }
    );

    // Background: notification received while app is backgrounded
    const removeBackground = PushNotifications.Android.setBackgroundListener(
      async (payload: PushNotifications.NotificationPayload) => {
        console.log("[AppAmbit] Background notification received");
        console.log("  title:", payload.notification.title);
        console.log("  body:", payload.notification.body);
        console.log("  data:", payload.notification.data);
      }
    );

    // Opened: user tapped the notification — works in all app states
    const removeOpened = PushNotifications.setOpenedListener(
      async (payload: PushNotifications.NotificationPayload) => {
        console.log("[AppAmbit] Notification opened by user");
        console.log("  title:", payload.notification.title);
        console.log("  body:", payload.notification.body);
        console.log("  data:", payload.notification.data);
        
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate("SecondScreen");
          }
        }, 300);
      }
    );

    return () => {
      removeForeground();
      removeBackground();
      removeOpened();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        registerNavigationTracking(navigationRef);
      }}
    >
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