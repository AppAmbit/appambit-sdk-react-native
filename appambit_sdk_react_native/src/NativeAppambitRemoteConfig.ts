import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    enable(): void;
    getString(key: string): string;
    getBoolean(key: string): boolean;
    getInt(key: string): number;
    getDouble(key: string): number;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppAmbitRemoteConfig');
