import Appambit from './NativeAppambitCore';
import AppambitAnalytics from './NativeAppambitAnalytics';
import AppambitCrashes from './NativeAppambitCrashes';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { Platform } from 'react-native';

type LogErrorParams = {
  exception?: any;
  message?: string;
  stack?: string;
  classFqn?: string;
  fileName?: string;
  lineNumber?: number;
  properties?: Record<string, string>;
};

export function registerNavigationTracking(
  navigationRef: NavigationContainerRefWithCurrent<any>
) {
  if (Platform.OS !== 'android') {
    return () => {};
  }

  let lastTrackedKey: string | null = null;
  let lastTrackedName: string | null = null;

  const onStateChange = () => {
    if (!navigationRef.isReady()) return;

    const route = navigationRef.getCurrentRoute();
    if (!route || route.key === lastTrackedKey) return;

    if (lastTrackedName) {
      addBreadcrumb(`On disappear: ${lastTrackedName}`);
    }

    addBreadcrumb(`On appear: ${route.name}`);

    lastTrackedKey = route.key;
    lastTrackedName = route.name;
  };

  return navigationRef.addListener("state", onStateChange);
}

// Start the Appambit SDK with the provided app key

export function start(appkey: string): void {
  Appambit.start(appkey);
}

// Breadcrumbs

export function addBreadcrumb(name: string): void {
  Appambit.addBreadcrumb(name);
}

// Analytics methods

export function setUserId(userId: string): void {
  AppambitAnalytics.setUserId(userId);
}

export function setUserEmail(userEmail: string): void {
  AppambitAnalytics.setUserEmail(userEmail);
}

export function clearToken(): void {
  AppambitAnalytics.clearToken();
}

export function startSession(): void {
  AppambitAnalytics.startSession();
}

export function endSession(): void {
  AppambitAnalytics.endSession();
}

export function enableManualSession(): void {
  AppambitAnalytics.enableManualSession();
}

export function trackEvent(eventTitle: string, properties?: Record<string, string>): void {
  AppambitAnalytics.trackEvent(eventTitle, properties);
}

export function generateTestEvent(): void {
  AppambitAnalytics.generateTestEvent();
}

// Crashes methods

export function didCrashInLastSession(): Promise<boolean> {
  return AppambitCrashes.didCrashInLastSession();
}

export function generateTestCrash(): void {
  AppambitCrashes.generateTestCrash();
}

export function logErrorMessage(message: string, properties?: Record<string, string>): void {
  AppambitCrashes.logErrorMessage(message, properties);
}

export async function logError({
  message,
  exception,
  stack,
  classFqn,
  fileName,
  lineNumber,
  properties,
}: LogErrorParams): Promise<void> {
  if (!AppambitCrashes) {
    console.warn('AppAmbitCrashes not registered');
    return;
  }

  const messageStr =
    message && message.length > 0
      ? message
      : exception
      ? exception.message || JSON.stringify(exception)
      : "UnknownError";

  const stackStr =
    stack && stack.length > 0
      ? stack
      : exception?.stack
      ? exception.stack.toString()
      : new Error().stack?.toString();

  const payload: Record<string, any> = {};

  if (messageStr) payload.message = messageStr;
  if (stackStr) payload.stack = stackStr;
  if (properties && Object.keys(properties).length > 0)
    payload.properties = properties;
  if (classFqn) payload.classFqn = classFqn;
  if (fileName) payload.fileName = fileName;
  
  if (typeof lineNumber === 'number' && !isNaN(lineNumber) && isFinite(lineNumber)) {
    payload.lineNumber = lineNumber;
  }

  if (Object.keys(payload).length === 0) return;

  const userProvidedMessage = !!message && message.length > 0;

  if (userProvidedMessage) {
    AppambitCrashes.logErrorMessage(message, properties);
  } else if (exception || (stackStr && stackStr.length > 0)) {
    AppambitCrashes.logError(payload);
  }
}

ErrorUtils.setGlobalHandler((error) => {
  const hasMessage = typeof error?.message === "string" && error.message.trim().length > 0;

  if (hasMessage) {
    logError({
      exception: error,
      message: error.message,
      stack: error.stack,
      classFqn: error.constructor?.name,
    });
  } else {
    logError({
      exception: error,
      stack: error.stack,
      classFqn: error.constructor?.name,
    });
  }
});