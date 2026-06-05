import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    getList(contentType: string, filters: Object[]): Promise<any[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppAmbitCms');
