import { NativeEventEmitter } from 'react-native';
import AppambitPushNotifications from './NativeAppambitPushNotifications';

export interface AndroidNotificationData {
  color: string | null;
  smallIconName: string | null;
  ticker: string | null;
  sticky: boolean | null;
  visibility: string | null;
  channelId: string | null;
  tag: string | null;
  sound: string | null;
  clickAction: string | null;
}

export interface IosNotificationData {
  subtitle: string | null;
  badge: number | null;
  sound: string | null;
  category: string | null;
  threadId: string | null;
}

export interface NotificationPayload {
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  data: Record<string, string>;
  android: AndroidNotificationData | null;
  ios: IosNotificationData | null;
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

export const hasNotificationPermission = async (): Promise<boolean> => {
  return AppambitPushNotifications.hasNotificationPermission();
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

export const Android = {
  setBackgroundListener: (
    callback: BackgroundNotificationListener
  ): (() => void) => {
    backgroundSub?.remove();
    backgroundSub = eventEmitter.addListener(
      EVENT_BACKGROUND,
      ((payload: NotificationPayload) => {
        void callback(payload).finally(() => {
          // Signal iOS that the async handler finished so it can reclaim background time.
          // On Android this is a no-op; background execution is managed by the headless task.
          AppambitPushNotifications.backgroundHandlerCompleted();
        });
      }) as any
    );
    return () => {
      backgroundSub?.remove();
      backgroundSub = null;
    };
  }
};