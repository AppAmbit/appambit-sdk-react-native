import { useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import * as AppAmbit from "appambit";
import * as PushNotifications from "appambit-push-notifications";

import CrashesScreen from "./screens/CrashesScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";

export default function App() {
  const [activeTab, setActiveTab] = useState<"Crashes" | "Analytics">("Crashes");
  //AppAmbit.enableManualSession();
  AppAmbit.start("<YOUR_APPKEY>");

  PushNotifications.setNotificationCustomizer((payload: PushNotifications.NotificationPayload) => {
    console.log("Customizer received payload:", payload);
    console.log("Customizer received data:", payload.data);
    console.log("Customizer received title:", payload.title);
    console.log("Customizer received body:", payload.body);
  });
  PushNotifications.start();

  return (
    <View style={{ flex: 1 }}>
      {activeTab === "Crashes" ? <CrashesScreen /> : <AnalyticsScreen />}

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
      </View>
    </View>
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