import { defineExtensionServer } from '@stackmap/extension-sdk';

import manifest from './manifest';
import { MIGRATIONS } from './server/migrations';

/** The extension's server code: the migrations of port forwards. */
export default defineExtensionServer(manifest, { migrations: MIGRATIONS });
