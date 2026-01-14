import { NativeEventEmitter } from 'react-native';
import AppambitPushNotifications from './NativeAppambitPushNotifications';

const eventEmitter = new NativeEventEmitter(AppambitPushNotifications);

export interface NotificationPayload {
  title?: string;
  body?: string;
  color?: string;
  icon?: string;
  data?: Record<string, string>;
}

export const start = (): void => {
  AppambitPushNotifications.start();
};

export const requestNotificationPermission = (): void => {
  AppambitPushNotifications.requestNotificationPermission();
};

export const requestNotificationPermissionWithResult = async (): Promise<boolean> => {
  return await AppambitPushNotifications.requestNotificationPermissionWithResult();
};

export const setNotificationsEnabled = (enabled: boolean): void => {
  AppambitPushNotifications.setNotificationsEnabled(enabled);
};

export const isNotificationsEnabled = async (): Promise<boolean> => {
  return await AppambitPushNotifications.isNotificationsEnabled();
};

export const setNotificationCustomizer = (
  callback: (payload: NotificationPayload) => void
): void => {
  eventEmitter.removeAllListeners('onNotificationReceived');
  eventEmitter.addListener(
    'onNotificationReceived',
    (payload: NotificationPayload) => {
      callback(payload);
    }
  );
};