import { defineExtensionServer } from '@stackmap/extension-sdk';

import manifest from './manifest';
import { dnsFlowDeriver } from './server/flows/dns';
import { MIGRATIONS } from './server/migrations';
import { REPOSITORIES } from './server/repositories';

/** The core's server code: the migrations and repositories of its entities, and the flows its DNS records give. */
export default defineExtensionServer(manifest, {
  migrations: MIGRATIONS,
  repositories: REPOSITORIES,
  flowDerivers: [dnsFlowDeriver],
});
