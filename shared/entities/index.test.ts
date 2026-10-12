import { describe, expect, it } from 'vitest';

import { ENTITY_SCHEMAS } from './index';
import { issuePaths } from '../../tests/support/issues';

const ID = '0199d6a0-0000-7000-8000-000000000001';

/** The smallest valid input of each entity. */
const MINIMAL: Record<keyof typeof ENTITY_SCHEMAS, Record<string, unknown>> = {
  site: { name: 'Home lab' },
  network: { name: 'Home LAN', kind: 'lan' },
  host: { name: 'Home server', kind: 'physical' },
  service: { name: 'Website', kind: 'app' },
  listener: { serviceId: ID, port: 443, transport: 'tcp' },
  domain: { name: 'homelab.example' },
  dnsRecord: { domainId: ID, name: '@', type: 'A', value: '203.0.113.10' },
};

const SET_BY_THE_REPOSITORY = {
  id: ID,
  workspaceId: ID,
  createdBy: 'someone',
  updatedBy: 'someone',
  createdAt: '2026-10-12T10:00:00.000Z',
  updatedAt: '2026-10-12T10:00:00.000Z',
};

const entities = Object.entries(ENTITY_SCHEMAS).map(([entity, schema]) => ({
  entity: entity as keyof typeof ENTITY_SCHEMAS,
  schema: schema,
}));

describe('entity schemas', () => {
  it.each(entities)('$entity has an input schema that applies defaults and a patch schema where every field is optional', ({ entity, schema }) => {
    expect(schema.input.safeParse(MINIMAL[entity]).data).toMatchObject({ ...MINIMAL[entity], status: 'active', tags: [] });
    expect(schema.patch.safeParse({}).data).toEqual({});
    expect(schema.patch.safeParse({ notes: 'Moved to the rack' }).data).toEqual({ notes: 'Moved to the rack' });
  });

  it('a patch that sets a nullable field to null clears it', () => {
    expect(ENTITY_SCHEMAS.network.patch.parse({ cidr: null, siteId: null })).toEqual({ cidr: null, siteId: null });
    expect(ENTITY_SCHEMAS.host.patch.parse({ os: null })).toEqual({ os: null });
    expect(ENTITY_SCHEMAS.service.patch.parse({ hostId: null })).toEqual({ hostId: null });
    expect(ENTITY_SCHEMAS.listener.patch.parse({ bindAddress: null })).toEqual({ bindAddress: null });
    expect(ENTITY_SCHEMAS.site.patch.parse({ externalRef: null })).toEqual({ externalRef: null });
  });

  it.each(entities)('$entity never accepts id, workspaceId or the audit fields as input', ({ entity, schema }) => {
    expect(schema.input.safeParse(MINIMAL[entity]).success).toBe(true);
    expect(schema.patch.safeParse({}).success).toBe(true);
    for (const [field, value] of Object.entries(SET_BY_THE_REPOSITORY)) {
      expect(schema.input.safeParse({ ...MINIMAL[entity], [field]: value }).success, field).toBe(false);
      expect(issuePaths(schema.patch.safeParse({ [field]: value })), field).not.toEqual([]);
    }
  });
});
