import { migration as portForward } from './0001_port_forward';

import type { Migration } from '@stackmap/extension-sdk/server';

/** The extension's migrations, in order: its own history, run after the core's. */
export const MIGRATIONS: Record<string, Migration> = {
  '0001_port_forward': portForward,
};
