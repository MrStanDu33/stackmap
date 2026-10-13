import { defineExtensionServer } from '@stackmap/extension-sdk';

import manifest from './manifest';
import { MIGRATIONS } from './server/migrations';
import { REPOSITORIES } from './server/repositories';

/** The core's server code: the migrations and repositories of its entities. */
export default defineExtensionServer(manifest, { migrations: MIGRATIONS, repositories: REPOSITORIES });
