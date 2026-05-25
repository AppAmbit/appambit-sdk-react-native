import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  start(): void;

  requestNotificationPermission(): void;
  requestNotificationPermissionWithResult(): Promise<boolean>;
  setNotificationsEnabled(enabled: boolean): void;
  isNotificationsEnabled(): Promise<boolean>;

  // iOS: call when the background notification async handler Promise resolves.
  // Signals iOS that background processing is complete so the system can reclaim
  // time and continue scheduling background wake-ups.
  backgroundHandlerCompleted(): void;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppambitPushNotifications');
