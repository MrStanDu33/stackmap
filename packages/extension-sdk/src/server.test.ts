import { DummyDriver, Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely';
import { describe, expect, it } from 'vitest';

import { withEntityColumns } from './server';

/** Compiles schema queries without a database. */
const cold = new Kysely<unknown>({
  dialect: {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
});

describe('withEntityColumns', () => {
  it('adds the common entity columns, the workspace reference and the unique (workspaceId, id) composite keys point to', () => {
    const { sql } = withEntityColumns(cold.schema.createTable('vpn_peer'), 'vpn_peer')
      .addColumn('name', 'text', (column) => column.notNull())
      .compile();

    for (const column of ['id', 'workspaceId', 'status', 'tags', 'notes', 'links', 'customFields', 'origin', 'externalRef', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt']) {
      expect(sql, column).toContain(`"${column}"`);
    }
    expect(sql).toContain('references "workspace" ("id") on delete cascade');
    expect(sql).toContain('constraint "vpn_peer_workspace_id_unique" unique ("workspaceId", "id")');
  });
});
