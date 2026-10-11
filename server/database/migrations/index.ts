import { migration as appSetting } from './0001_app_setting';

import type { Migration } from 'kysely/migration';

/** Every migration, in order. Listed explicitly so the production bundle contains them. */
export const MIGRATIONS: Record<string, Migration> = {
  '0001_app_setting': appSetting,
};
