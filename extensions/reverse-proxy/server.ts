import { defineExtensionServer } from '@stackmap/extension-sdk';

import manifest from './manifest';
import { MIGRATIONS } from './server/migrations';
import { REPOSITORIES } from './server/repositories';

/** The extension's server code: the migrations and repository of proxy routes. */
export default defineExtensionServer(manifest, { migrations: MIGRATIONS, repositories: REPOSITORIES });
