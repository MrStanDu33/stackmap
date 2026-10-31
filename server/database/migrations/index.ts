import { migration as appSetting } from './0001_app_setting';
import { migration as workspace } from './0002_workspace';
import { migration as derivedFlow } from './0003_derived_flow';
import { migration as auth } from './0004_auth';
import { migration as member } from './0005_member';

import type { Migration } from 'kysely/migration';

/** Every migration, in order. Listed explicitly so the production bundle contains them. */
export const MIGRATIONS: Record<string, Migration> = {
  '0001_app_setting': appSetting,
  '0002_workspace': workspace,
  '0003_derived_flow': derivedFlow,
  '0004_auth': auth,
  '0005_member': member,
};
