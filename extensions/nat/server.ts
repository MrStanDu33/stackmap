import { defineExtensionServer } from '@stackmap/extension-sdk';

import manifest from './manifest';
import { portForwardFlowDeriver } from './server/flows/port-forwards';
import { MIGRATIONS } from './server/migrations';
import { REPOSITORIES } from './server/repositories';
import { portForwardHopResolver } from './server/traces/port-forwards';

/** The extension's server code: the migrations and repository of port forwards, their flows and their trace hops. */
export default defineExtensionServer(manifest, {
  migrations: MIGRATIONS,
  repositories: REPOSITORIES,
  flowDerivers: [portForwardFlowDeriver],
  traceHopResolvers: [portForwardHopResolver],
});
