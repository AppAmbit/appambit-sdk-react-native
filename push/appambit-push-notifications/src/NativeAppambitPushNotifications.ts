import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  start(): void;
  requestNotificationPermission(): void;
  requestNotificationPermissionWithResult(): Promise<boolean>;
  setNotificationsEnabled(enabled: boolean): void;
  isNotificationsEnabled(): Promise<boolean>;

  setNotificationCustomizer(): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppambitPushNotifications');
