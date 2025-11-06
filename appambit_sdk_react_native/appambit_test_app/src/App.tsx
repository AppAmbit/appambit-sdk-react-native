import { Text, StyleSheet, Button, ScrollView, Alert } from 'react-native';
import { 
  start, 
  setUserId, 
  setUserEmail, 
  clearToken, 
  startSession, 
  endSession, 
  enableManualSession, 
  trackEvent, 
  generateTestEvent, 
  generateTestCrash, 
  didCrashInLastSession,
  logError
} from 'appambit';

import { useEffect, useState } from 'react';

export default function App() {
  const [crashedLast, setCrashedLast] = useState<boolean>(false);

  useEffect(() => {
    //Uncomment the line for automatic session management
    //enableManualSession();
    start("<YOUR-APPKEY>");
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AppAmbit Test</Text>

      <Text style={styles.subtitle}>
        Did crash in last session: {crashedLast ? "Yes" : "No"}
      </Text>

      <Button
        title="Did Crash?"
        onPress={() => {
          const result = didCrashInLastSession();
          setCrashedLast(result);
          Alert.alert("AppAmbit", result ? "There was a crash" : "There wasn't a crash");
        }}
      />

      <Button
        title="Set User ID"
        onPress={() => {
          setUserId("12345");
          Alert.alert("AppAmbit", "User ID set: 12345");
        }}
      />

      <Button
        title="Set User Email"
        onPress={() => {
          setUserEmail("user@example.com");
          Alert.alert("AppAmbit", "Email set: user@example.com");
        }}
      />

      <Button
        title="Clear Token"
        onPress={() => {
          clearToken();
          Alert.alert("AppAmbit", "Token cleared");
        }}
      />

      <Button
        title="Start Session"
        onPress={() => {
          startSession();
          Alert.alert("AppAmbit", "Sesion started");
        }}
      />

      <Button
        title="End Session"
        onPress={() => {
          endSession();
          Alert.alert("AppAmbit", "Sesion ended");
        }}
      />

      <Button
        title="Enable Manual Session"
        onPress={() => {
          enableManualSession();
          Alert.alert("AppAmbit", "Manual session enabled");
        }}
      />

      <Button
        title="Track Event"
        onPress={() => {
          trackEvent("Login", { method: "Google", success: "true" });
          Alert.alert("AppAmbit", "Event 'Login' tracked");
        }}
      />

      <Button
        title="Generate Test Event"
        onPress={() => {
          generateTestEvent();
          Alert.alert("AppAmbit", "Test event generated");
        }}
      />

      <Button
        title="Crash JS (Simulated)"
        onPress={() => {
          Alert.alert("AppAmbit", "Error message logged");
          throw new Error("Simulated JS Crash");
        }}
      />

      <Button
        title="Generate Test Crash"
        onPress={() => {
          generateTestCrash();
        }}
      />

      <Button
        title="Log Error Message"
        onPress={() => {
          logError({
            message: "Test error message",
            properties: { screen: "Home" }
          });
          Alert.alert("AppAmbit", "Error message logged");
        }}
      />

      <Button
        title="Log Error (JS Exception)"
        onPress = {() => {
            try {
              throw new Error();
            } catch (e : any) {
              logError(
                { stack: e.stack, exception: e, classFqn: e.constructor.name },
              );
              Alert.alert(e.stack, e);
              Alert.alert("AppAmbit", "Exception JS logged" );
            }
          }
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
});
