import { migration as site } from './0001_site';
import { migration as network } from './0002_network';
import { migration as host } from './0003_host';
import { migration as service } from './0004_service';
import { migration as listener } from './0005_listener';
import { migration as domain } from './0006_domain';

import type { Migration } from '@stackmap/extension-sdk/server';

/** The core's migrations, in order: its own history (`kysely_migration_core`), run after the app's. */
export const MIGRATIONS: Record<string, Migration> = {
  '0001_site': site,
  '0002_network': network,
  '0003_host': host,
  '0004_service': service,
  '0005_listener': listener,
  '0006_domain': domain,
};
