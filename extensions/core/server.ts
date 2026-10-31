import { defineExtensionServer } from '@stackmap/extension-sdk';

import manifest from './manifest';
import { dnsFlowDeriver } from './server/flows/dns';
import { MIGRATIONS } from './server/migrations';
import { REPOSITORIES } from './server/repositories';
import { dnsRecordHopResolver } from './server/traces/dns';

/**
 * The core's server code: the migrations and repositories of its entities, the flows its DNS records give, and the
 * trace hops of those records.
 */
export default defineExtensionServer(manifest, {
  migrations: MIGRATIONS,
  repositories: REPOSITORIES,
  flowDerivers: [dnsFlowDeriver],
  traceHopResolvers: [dnsRecordHopResolver],
});
