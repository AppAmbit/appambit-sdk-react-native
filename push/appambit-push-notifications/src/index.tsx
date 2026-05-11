/**
 * appambit-push-notifications — Public JavaScript API
 *
 * Usage:
 *
 *   import * as AppAmbitPush from 'appambit-push-notifications';
 *
 *   // 1. Start the SDK (call once, ideally in your App root / MainApplication)
 *   AppAmbitPush.start();
 *
 *   // 2. Request permission (Android 13+)
 *   AppAmbitPush.requestNotificationPermission();
 *
 *   // 3. Listen for foreground notifications
 *   AppAmbitPush.setForegroundNotificationListener((notification) => {
 *     console.log('Foreground:', notification);
 *   });
 *
 *   // 4. Listen for background notifications
 *   AppAmbitPush.setBackgroundNotificationListener(async (notification) => {
 *     console.log('Background:', notification);
 *   });
 *
 *   // 5. Listen for notification taps (opened)
 *   AppAmbitPush.setOpenedNotificationListener((notification) => {
 *     console.log('Opened:', notification);
 *   });
 *
 *   // 6. Register the Headless JS background task (must be in index.js, not App.tsx)
 *   import { AppRegistry } from 'react-native';
 *   AppRegistry.registerHeadlessTask(
 *     AppAmbitPush.BACKGROUND_NOTIFICATION_TASK,
 *     () => async (notification) => {
 *       console.log('Headless background notification:', notification);
 *     }
 *   );
 */

import { NativeEventEmitter, Platform } from 'react-native';
import AppambitPushNotifications from './NativeAppambitPushNotifications';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape of a notification as received by all JS listeners. */
export interface NotificationPayload {
  /** The notification metadata (title, body, etc.) */
  notification: {
    title: string | null;
    body: string | null;
    color: string | null;
    smallIcon: string | null;
    data: Record<string, string>;
  };
  /** Shorthand access to the raw data payload (same reference as notification.data) */
  data: Record<string, string>;
}

/** Callback types */
export type NotificationListener = (notification: NotificationPayload) => void;
export type BackgroundNotificationListener = (notification: NotificationPayload) => Promise<void>;

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Headless JS task name to register with AppRegistry.
 * This must match HEADLESS_TASK_NAME in AppAmbitHeadlessService.kt
 */
export const BACKGROUND_NOTIFICATION_TASK = 'AppAmbitBackgroundNotification';

// ── Internal event names (must match AppAmbitPushEventEmitter.kt) ─────────────

const EVENT_FOREGROUND = 'AppAmbit_onForegroundNotification';
const EVENT_BACKGROUND = 'AppAmbit_onBackgroundNotification';
const EVENT_OPENED     = 'AppAmbit_onOpenedNotification';

// ── Event emitter ─────────────────────────────────────────────────────────────

const eventEmitter = new NativeEventEmitter(AppambitPushNotifications);

// Track active subscriptions so we can remove them cleanly.
let foregroundSub: ReturnType<typeof eventEmitter.addListener> | null = null;
let backgroundSub: ReturnType<typeof eventEmitter.addListener> | null = null;
let openedSub:     ReturnType<typeof eventEmitter.addListener> | null = null;

// ── SDK Lifecycle ─────────────────────────────────────────────────────────────

/**
 * Starts the AppAmbit Push SDK.
 * Must be called before using any other method.
 * Safe to call multiple times — idempotent.
 */
export const start = (): void => {
  AppambitPushNotifications.start();
};

// ── Permissions ───────────────────────────────────────────────────────────────

/**
 * Requests POST_NOTIFICATIONS permission on Android 13+.
 * On older Android versions and iOS this is a no-op.
 */
export const requestNotificationPermission = (): void => {
  AppambitPushNotifications.requestNotificationPermission();
};

/**
 * Like requestNotificationPermission but resolves to whether permission was granted.
 */
export const requestNotificationPermissionWithResult =
  async (): Promise<boolean> => {
    return AppambitPushNotifications.requestNotificationPermissionWithResult();
  };

// ── Opt-in / Opt-out ─────────────────────────────────────────────────────────

/** Enable or disable push notifications for this installation. */
export const setNotificationsEnabled = (enabled: boolean): void => {
  AppambitPushNotifications.setNotificationsEnabled(enabled);
};

/** Resolves to whether notifications are currently enabled. */
export const isNotificationsEnabled = async (): Promise<boolean> => {
  return AppambitPushNotifications.isNotificationsEnabled();
};

// ── Notification Listeners ────────────────────────────────────────────────────

/**
 * Sets a listener that fires when a notification is received while the app
 * is in the FOREGROUND.
 *
 * Only one foreground listener is supported at a time.
 * Calling this again replaces the previous listener.
 *
 * @param callback  Receives a NotificationPayload.
 * @returns         A remove function to unsubscribe.
 */
export const setForegroundNotificationListener = (
  callback: NotificationListener
): (() => void) => {
  foregroundSub?.remove();
  // Cast to 'any': NativeEventEmitter types callbacks as '(...args: readonly Object[]) => unknown'
  // but our NotificationPayload is more specific. The cast is safe — runtime shape is correct.
  foregroundSub = eventEmitter.addListener(EVENT_FOREGROUND, callback as any);
  return () => {
    foregroundSub?.remove();
    foregroundSub = null;
  };
};

/**
 * Sets a listener that fires when a notification arrives while the app is
 * in the BACKGROUND or KILLED.
 *
 * This event is emitted by the native bridge when the React host is alive.
 * For the killed-state case, use AppRegistry.registerHeadlessTask with
 * BACKGROUND_NOTIFICATION_TASK as the task name.
 *
 * Only one background listener is supported at a time.
 *
 * @param callback  Async callback. Its completion is awaited by the bridge.
 * @returns         A remove function to unsubscribe.
 */
export const setBackgroundNotificationListener = (
  callback: BackgroundNotificationListener
): (() => void) => {
  backgroundSub?.remove();
  backgroundSub = eventEmitter.addListener(
    EVENT_BACKGROUND,
    ((payload: NotificationPayload) => {
      void callback(payload);
    }) as any
  );
  return () => {
    backgroundSub?.remove();
    backgroundSub = null;
  };
};

/**
 * Sets a listener that fires when the user TAPS a notification (opens the app).
 *
 * Works across all app states:
 *  - Foreground: fires immediately
 *  - Background: fires when the user taps the notification
 *  - Cold start: payload is queued natively and delivered once the bridge is ready
 *
 * Only one opened listener is supported at a time.
 *
 * @param callback  Receives a NotificationPayload with the tapped notification data.
 * @returns         A remove function to unsubscribe.
 */
export const setOpenedNotificationListener = (
  callback: NotificationListener
): (() => void) => {
  openedSub?.remove();
  openedSub = eventEmitter.addListener(EVENT_OPENED, callback as any);
  return () => {
    openedSub?.remove();
    openedSub = null;
  };
};

// ── Legacy API (backward compat) ──────────────────────────────────────────────

/**
 * @deprecated Use setForegroundNotificationListener instead.
 *
 * Kept for backward compatibility. The callback is wired to the foreground
 * notification event with the legacy { notification, data } shape.
 */
export const setNotificationCustomizer = (
  callback: (payload: NotificationPayload) => void
): void => {
  if (Platform.OS === 'android') {
    AppambitPushNotifications.setNotificationCustomizer();
  }
  setForegroundNotificationListener(callback);
};