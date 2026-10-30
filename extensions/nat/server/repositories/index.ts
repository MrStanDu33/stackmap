import { portForwardRepository } from './port-forwards';

import type { PortForwardRepository } from './port-forwards';
import type { EntityRepositoryDefinition } from '@stackmap/extension-sdk/server';

declare module '@stackmap/extension-sdk/server' {
  interface EntityRepositories {
    portForwards: PortForwardRepository;
  }
}

export type { PortForwardRepository };

/** The extension's repository definitions, one per entity its manifest declares. */
export const REPOSITORIES: readonly EntityRepositoryDefinition[] = [
  portForwardRepository,
] as readonly EntityRepositoryDefinition[];
