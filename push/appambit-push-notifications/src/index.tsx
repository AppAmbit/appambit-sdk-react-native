import AppambitPushNotifications from './NativeAppambitPushNotifications';

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