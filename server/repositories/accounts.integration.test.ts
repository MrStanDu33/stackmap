import { describe, expect, it } from 'vitest';

import { hitRateLimit } from './accounts';
import { DIALECTS } from '../../tests/support/databases';
import { useTestWorkspaces } from '../../tests/support/workspaces';

import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

describe.each(DIALECTS)('attempt limits on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const limit = { windowMs: 60_000, max: 5 };

  it('removes the counts whose window has passed, so the table does not grow with every address seen', async () => {
    const start = Date.now();
    for (const address of ['192.0.2.1', '192.0.2.2', '192.0.2.3']) {
      await hitRateLimit(db(), `sign-in:${address}`, { ...limit, now: start });
    }

    await hitRateLimit(db(), 'sign-in:192.0.2.4', { ...limit, now: start + 2 * 60_000 });

    const keys = await db().selectFrom('rateLimit').select('key').execute();
    expect(keys.map(({ key }) => key)).toEqual(['sign-in:192.0.2.4']);
  });
});
