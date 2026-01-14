import { useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import * as AppAmbit from "appambit";
import * as AppAmbitPushNotifications from "appambit-push-notifications";

import CrashesScreen from "./screens/CrashesScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";

export default function App() {
  const [activeTab, setActiveTab] = useState<"Crashes" | "Analytics">("Crashes");

  //AppAmbit.enableManualSession();
  AppAmbit.start("e1c87a4d-c5f9-4b68-9673-3441ca41abd4");

  AppAmbitPushNotifications.setNotificationCustomizer((data: Record<string, string>) => {
    console.log("Customizer received data:", data);
    console.log("Returning customized notification payload.", data.title, data.body);
  });

  AppAmbitPushNotifications.start();

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