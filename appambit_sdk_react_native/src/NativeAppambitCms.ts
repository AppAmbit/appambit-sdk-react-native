import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    getList(contentType: string, filters: Object[]): Promise<any[]>;
    clearCache(contentType: string): void;
    clearAllCache(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppAmbitCms');
