/**
 * NativeAppambitPushNotifications.ts
 *
 * Turbo Module specification for the AppAmbit Push Notifications SDK.
 * This file is the single source of truth for the native bridge API.
 * Codegen reads this file to generate the matching C++ / Java / Kotlin specs.
 *
 * DO NOT add platform-specific logic here — this is a pure type declaration.
 */

import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  // ── Lifecycle ─────────────────────────────────────────────────────────────
  /** Starts the Push SDK, initialises Firebase and fetches the FCM token. */
  start(): void;

  // ── Permissions ───────────────────────────────────────────────────────────
  /** Requests POST_NOTIFICATIONS permission (Android 13+). Fire-and-forget. */
  requestNotificationPermission(): void;
  /** Same as above but resolves to the permission result via a Promise. */
  requestNotificationPermissionWithResult(): Promise<boolean>;

  // ── Opt-in / Opt-out ─────────────────────────────────────────────────────
  /** Enables or disables push notifications for the current installation. */
  setNotificationsEnabled(enabled: boolean): void;
  /** Resolves to the current enabled state. */
  isNotificationsEnabled(): Promise<boolean>;

  // ── Legacy (kept for backward compat, no-op on Android) ──────────────────
  /** @deprecated Use setForegroundNotificationListener instead. */
  setNotificationCustomizer(): void;

  // ── NativeEventEmitter contract ───────────────────────────────────────────
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppambitPushNotifications');
