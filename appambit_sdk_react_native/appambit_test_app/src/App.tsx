import { useState, useEffect } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { registerNavigationTracking, start } from "appambit";

import CrashesScreen from "./screens/CrashesScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import SecondScreen from "./screens/SecondScreen";

type RootStackParamList = {
  HomeScreen: undefined;
  SecondScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen() {
  const [activeTab, setActiveTab] = useState<"Crashes" | "Analytics">("Crashes");

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

export default function App() {
  useEffect(() => {
    start("<YOUR-APPKEY>");
  }, []);

  const navigationRef = useNavigationContainerRef();

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