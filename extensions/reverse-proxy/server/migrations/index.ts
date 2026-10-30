import { migration as route } from './0001_route';

import type { Migration } from '@stackmap/extension-sdk/server';

/** The extension's migrations, in order: its own history, run after the core's. */
export const MIGRATIONS: Record<string, Migration> = {
  '0001_route': route,
};
