import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  call(
    requestId: string,
    fn: string,
    method: string,
    query: Object,
    body: Object,
    headers: Object
  ): Promise<Object>;
  cancel(requestId: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppAmbitCloudCode');
