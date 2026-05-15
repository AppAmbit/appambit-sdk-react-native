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
    imageUrl: string | null;
    ticker: string | null;
    sticky: boolean | null;
    visibility: string | null;
    channelId: string | null;
    priority: string | null;
    tag: string | null;
    sound: string | null;
    clickAction: string | null;
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
 * Register a listener to handle notifications received while the app is in the foreground.
 */
export const setForegroundListener = (
  callback: NotificationListener
): (() => void) => {
  foregroundSub?.remove();
  foregroundSub = eventEmitter.addListener(EVENT_FOREGROUND, callback as any);
  return () => {
    foregroundSub?.remove();
    foregroundSub = null;
  };
};

/**
 * Register a listener to handle notifications received while the app is in the background or killed state.
 * (Android only — iOS uses different background handling patterns).
 */
export const setAndroidBackgroundListener = (
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
 * Register a listener to handle the scenario where a notification is clicked/opened.
 */
export const setOpenedListener = (
  callback: NotificationListener
): (() => void) => {
  openedSub?.remove();
  openedSub = eventEmitter.addListener(EVENT_OPENED, callback as any);
  return () => {
    openedSub?.remove();
    openedSub = null;
  };
};

/**
 * LEGACY: Kept for backward compatibility.
 * Use setForegroundListener directly.
 */
export const setNotificationCustomizer = (
  callback: (payload: NotificationPayload) => void
): void => {
  if (Platform.OS === 'android') {
    AppambitPushNotifications.setNotificationCustomizer();
  }
  setForegroundListener(callback);
};