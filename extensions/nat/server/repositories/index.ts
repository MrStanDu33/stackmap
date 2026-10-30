import type { PortForwardRepository } from './port-forwards';

declare module '@stackmap/extension-sdk/server' {
  interface EntityRepositories {
    portForwards: PortForwardRepository;
  }
}

export type { PortForwardRepository };
