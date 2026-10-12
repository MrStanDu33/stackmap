import { migration as appSetting } from './0001_app_setting';
import { migration as workspace } from './0002_workspace';
import { migration as site } from './0003_site';
import { migration as network } from './0004_network';
import { migration as host } from './0005_host';
import { migration as service } from './0006_service';
import { migration as listener } from './0007_listener';
import { migration as domain } from './0008_domain';

import type { Migration } from 'kysely/migration';

/** Every migration, in order. Listed explicitly so the production bundle contains them. */
export const MIGRATIONS: Record<string, Migration> = {
  '0001_app_setting': appSetting,
  '0002_workspace': workspace,
  '0003_site': site,
  '0004_network': network,
  '0005_host': host,
  '0006_service': service,
  '0007_listener': listener,
  '0008_domain': domain,
};
