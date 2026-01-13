import { NativeEventEmitter } from 'react-native';
import AppambitPushNotifications from './NativeAppambitPushNotifications';

const eventEmitter = new NativeEventEmitter(AppambitPushNotifications);

export const start = (): void => {
  AppambitPushNotifications.start();
};

export const requestNotificationPermission = (): void => {
  AppambitPushNotifications.requestNotificationPermission();
};

export const setNotificationsEnabled = (enabled: boolean): void => {
  AppambitPushNotifications.setNotificationsEnabled(enabled);
};

export const isNotificationsEnabled = async (): Promise<boolean> => {
  return await AppambitPushNotifications.isNotificationsEnabled();
};

export const setNotificationCustomizer = (
  callback: (data: Record<string, string>) => void
): void => {
  AppambitPushNotifications.setNotificationCustomizer();
  eventEmitter.removeAllListeners('onNotificationReceived');
  eventEmitter.addListener('onNotificationReceived', callback as any);
};