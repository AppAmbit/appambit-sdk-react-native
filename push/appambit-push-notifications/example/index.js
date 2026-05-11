/**
 * AppAmbit Push Notifications — Example App Entry Point
 *
 * IMPORTANT: The Headless JS task registration MUST be here in index.js,
 * NOT inside a React component or App.tsx. React Native needs the task
 * registered before any component renders — including when the app is
 * launched headlessly (i.e. killed state, no UI).
 */

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { BACKGROUND_NOTIFICATION_TASK } from 'appambit-push-notifications';

// ── Headless JS background task ───────────────────────────────────────────────
//
// This task is executed by AppAmbitHeadlessService when a notification arrives
// while the app is KILLED or BACKGROUNDED. It runs in a separate JS context
// with no UI, exactly like react-native-firebase/messaging background handler.
//
// Guidelines:
//  • Keep the handler fast (< 30 s, the native timeout).
//  • Do not access UI state here — no React hooks, no setState.
//  • Use this for: badge counts, local DB updates, analytics pings, etc.
//
AppRegistry.registerHeadlessTask(
  BACKGROUND_NOTIFICATION_TASK,
  () => async (notification) => {
    console.log('[AppAmbit Headless] Background notification received:', notification);
    // ↑ Replace with your actual background logic:
    //   e.g. AsyncStorage.setItem('lastNotification', JSON.stringify(notification));
  }
);

// ── Main app component ────────────────────────────────────────────────────────
AppRegistry.registerComponent(appName, () => App);
