import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  start(appkey: string): void;
  addBreadcrumb(name: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppAmbitCore');