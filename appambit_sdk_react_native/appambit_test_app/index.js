import { AppRegistry, Platform } from 'react-native';
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
    }
  );
}

AppRegistry.registerComponent(appName, () => App);
