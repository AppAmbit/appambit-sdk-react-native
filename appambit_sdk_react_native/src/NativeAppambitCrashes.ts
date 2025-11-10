import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    generateTestCrash(): void;
    didCrashInLastSession(): boolean;
    logErrorMessage(
        message: string,
        properties?: { [key: string]: string }
    ): void;
    logError(payload: ErrorPayload): void;
}

interface ErrorPayload {
  exception?: Object;
  message?: string;
  stack?: string;
  classFqn?: string;
  fileName?: string;
  lineNumber?: number;
  properties?: { [key: string]: string };
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppAmbitCrashes');