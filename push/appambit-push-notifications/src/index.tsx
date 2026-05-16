import { NativeEventEmitter } from 'react-native';
import AppambitPushNotifications from './NativeAppambitPushNotifications';

export interface NotificationPayload {
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
  data: Record<string, string>;
}

export type NotificationListener = (notification: NotificationPayload) => void;
export type BackgroundNotificationListener = (notification: NotificationPayload) => Promise<void>;

export const BACKGROUND_NOTIFICATION_TASK = 'AppAmbitBackgroundNotification';

const EVENT_FOREGROUND = 'AppAmbit_onForegroundNotification';
const EVENT_BACKGROUND = 'AppAmbit_onBackgroundNotification';
const EVENT_OPENED     = 'AppAmbit_onOpenedNotification';

const eventEmitter = new NativeEventEmitter(AppambitPushNotifications);

let foregroundSub: ReturnType<typeof eventEmitter.addListener> | null = null;
let backgroundSub: ReturnType<typeof eventEmitter.addListener> | null = null;
let openedSub:     ReturnType<typeof eventEmitter.addListener> | null = null;

export const start = (): void => {
  AppambitPushNotifications.start();
};

export const requestNotificationPermission = (): void => {
  AppambitPushNotifications.requestNotificationPermission();
};

export const requestNotificationPermissionWithResult =
  async (): Promise<boolean> => {
    return AppambitPushNotifications.requestNotificationPermissionWithResult();
  };

export const setNotificationsEnabled = (enabled: boolean): void => {
  AppambitPushNotifications.setNotificationsEnabled(enabled);
};

export const isNotificationsEnabled = async (): Promise<boolean> => {
  return AppambitPushNotifications.isNotificationsEnabled();
};

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