import { AppRegistry, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as PushNotifications from 'appambit-push-notifications';
import App from './src/App';
import { name as appName } from './app.json';

// Register Headless Task for Android background notifications
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask(
    PushNotifications.BACKGROUND_NOTIFICATION_TASK,
    () => async (payload) => {
      console.log('[AppAmbit] Headless task received background notification');
      console.log("PAYLOAD", payload)
      console.log("PAYLOAD - title: ", payload.title)
      console.log("PAYLOAD - body: ", payload.body)
      console.log("PAYLOAD.data", payload.data)
      
      try {
        await AsyncStorage.setItem('last_background_push', JSON.stringify(payload));
        console.log('[AppAmbit] Headless payload saved to storage');
      } catch (e) {
        console.error('[AppAmbit] Headless storage error', e);
      }
    }
  );
}

AppRegistry.registerComponent(appName, () => App);
