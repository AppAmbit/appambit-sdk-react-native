import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PushNotificationScreen = () => {
  const [lastNotification, setLastNotification] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotification = async () => {
    setRefreshing(true);
    try {
      const data = await AsyncStorage.getItem('last_background_push');
      if (data) {
        setLastNotification(JSON.parse(data));
      }
    } catch (error) {
      console.error('Failed to load notification:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const clearNotification = async () => {
    try {
      await AsyncStorage.removeItem('last_background_push');
      setLastNotification(null);
    } catch (error) {
      console.error('Failed to clear notification:', error);
    }
  };

  useEffect(() => {
    loadNotification();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Background Push</Text>
        <Text style={styles.subtitle}>Verify JS execution when app is closed</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadNotification} tintColor="#007AFF" />
        }
      >
        {lastNotification ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Last Received Payload</Text>
              <Text style={styles.timestamp}>{new Date().toLocaleTimeString()}</Text>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.label}>Title</Text>
              <Text style={styles.value}>{lastNotification.notification?.title || 'N/A'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Body</Text>
              <Text style={styles.value}>{lastNotification.notification?.body || 'N/A'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Raw Data</Text>
              <View style={styles.jsonContainer}>
                <Text style={styles.jsonText}>
                  {JSON.stringify(lastNotification.data || {}, null, 2)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No background notifications detected yet.</Text>
            <Text style={styles.emptySubtext}>Send a silent push or a background notification while the app is closed.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.refreshButton} onPress={loadNotification}>
          <Text style={styles.buttonText}>Refresh Data</Text>
        </Pressable>
        <Pressable style={[styles.refreshButton, styles.clearButton]} onPress={clearNotification}>
          <Text style={styles.buttonText}>Clear Storage</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  jsonContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  jsonText: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: '#495057',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  refreshButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PushNotificationScreen;
