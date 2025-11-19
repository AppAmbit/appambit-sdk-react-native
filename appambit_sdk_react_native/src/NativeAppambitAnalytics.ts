import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    setUserId(userId: string): void;
    setUserEmail(email: string): void;
    clearToken(): void;
    startSession(): void;
    endSession(): void;
    enableManualSession(): void;
    trackEvent(eventTitle: string, properties?: Object): void;
    generateTestEvent(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppAmbitAnalytics');