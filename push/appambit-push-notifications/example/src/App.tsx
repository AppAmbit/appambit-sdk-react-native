/**
 * AppAmbit Push Notifications — Example App
 *
 * Demonstrates all three notification states:
 *  • Foreground  — notification received while app is open
 *  • Background  — notification received while app is backgrounded
 *  • Opened      — user taps the notification to open the app
 *
 * ⚠️  The BACKGROUND_NOTIFICATION_TASK Headless JS registration MUST live in
 *     the entry point (index.js), NOT in a component. See example/index.js.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView } from 'react-native';
import * as AppAmbitPush from 'appambit-push-notifications';

interface LogEntry {
  type: 'foreground' | 'background' | 'opened';
  title: string | null;
  body: string | null;
  timestamp: string;
}

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 50)); // keep last 50
  };

  useEffect(() => {
    // ── 1. Start the SDK ──────────────────────────────────────────────────────
    AppAmbitPush.start();

    // ── 2. Request permission (Android 13+) ───────────────────────────────────
    AppAmbitPush.requestNotificationPermission();

    // ── 3. Foreground notifications ───────────────────────────────────────────
    const removeForeground = AppAmbitPush.setForegroundNotificationListener(
      (payload) => {
        console.log('[AppAmbit] Foreground notification:', payload);
        addLog({
          type: 'foreground',
          title: payload.notification.title,
          body: payload.notification.body,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    );

    // ── 4. Background notifications ───────────────────────────────────────────
    const removeBackground = AppAmbitPush.setBackgroundNotificationListener(
      async (payload) => {
        // NOTE: For killed-state handling, the Headless task in index.js fires.
        // This listener fires when the React host is alive but app is backgrounded.
        console.log('[AppAmbit] Background notification:', payload);
        addLog({
          type: 'background',
          title: payload.notification.title,
          body: payload.notification.body,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    );

    // ── 5. Opened notifications ───────────────────────────────────────────────
    const removeOpened = AppAmbitPush.setOpenedNotificationListener((payload) => {
      console.log('[AppAmbit] Notification opened:', payload);
      addLog({
        type: 'opened',
        title: payload.notification.title,
        body: payload.notification.body,
        timestamp: new Date().toLocaleTimeString(),
      });
    });

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      removeForeground();
      removeBackground();
      removeOpened();
    };
  }, []);

  const typeColor = {
    foreground: '#4CAF50',
    background: '#FF9800',
    opened: '#2196F3',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>AppAmbit Push SDK</Text>
        <Text style={styles.subtitle}>Notification Log</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {logs.length === 0 ? (
          <Text style={styles.empty}>
            No notifications yet.{'\n'}Send a push from the AppAmbit dashboard.
          </Text>
        ) : (
          logs.map((log, index) => (
            <View key={index} style={styles.logCard}>
              <View style={[styles.badge, { backgroundColor: typeColor[log.type] }]}>
                <Text style={styles.badgeText}>{log.type.toUpperCase()}</Text>
              </View>
              <Text style={styles.logTitle}>{log.title ?? '(no title)'}</Text>
              <Text style={styles.logBody}>{log.body ?? '(no body)'}</Text>
              <Text style={styles.logTime}>{log.timestamp}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  header: {
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e0e0ff',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  empty: {
    color: '#555',
    textAlign: 'center',
    marginTop: 60,
    lineHeight: 22,
  },
  logCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  logTitle: {
    color: '#e0e0ff',
    fontSize: 15,
    fontWeight: '600',
  },
  logBody: {
    color: '#aaa',
    fontSize: 13,
  },
  logTime: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
  },
});
