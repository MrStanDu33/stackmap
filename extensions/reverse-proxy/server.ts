import { defineExtensionServer } from '@stackmap/extension-sdk';

import manifest from './manifest';
import { routeFlowDeriver } from './server/flows/routes';
import { MIGRATIONS } from './server/migrations';
import { REPOSITORIES } from './server/repositories';

/** The extension's server code: the migrations and repository of proxy routes, and the flows they give. */
export default defineExtensionServer(manifest, {
  migrations: MIGRATIONS,
  repositories: REPOSITORIES,
  flowDerivers: [routeFlowDeriver],
});
