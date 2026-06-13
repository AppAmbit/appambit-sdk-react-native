import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  execute(sql: string, params: Object[]): Promise<Object>;
  batch(statements: Object[], transaction: boolean): Promise<Object[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppAmbitDatabase');
