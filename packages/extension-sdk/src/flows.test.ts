import { describe, expect, it } from 'vitest';

import { flowDraftSchema, flowDraftsSchema, MAX_FLOW_DRAFTS } from './flows';
import { defineExtensionServer } from './hooks';
import { issuePaths } from '../../../tests/support/issues';

import type { FlowDeriver, FlowDraft } from './flows';
import type { ExtensionManifest } from './manifest';

const vpn: ExtensionManifest = {
  id: 'vpn',
  version: '1.0.0',
  apiVersion: 1,
  name: 'extensions.vpn.name',
  description: 'extensions.vpn.description',
  alwaysOn: false,
  dependsOn: [],
  code: { server: true },
  contributes: { kinds: {} },
};

const SERVICE_ID = '0199d6a0-0000-7000-8000-000000000001';
const LISTENER_ID = '0199d6a0-0000-7000-8000-000000000002';

const draft = (overrides: Record<string, unknown> = {}) => ({
  key: 'peer-1',
  source: { serviceId: SERVICE_ID },
  targetListenerId: LISTENER_ID,
  basis: [{ entity: 'peer', id: SERVICE_ID }],
  ...overrides,
});

const deriver = (id: string): FlowDeriver => ({ id, derive: () => Promise.resolve([]) });

describe('flow derivers', () => {
  it('given flowDerivers, defineExtensionServer keeps them frozen with the extension', () => {
    const peers = deriver('peers');

    const server = defineExtensionServer(vpn, { flowDerivers: [peers] });

    expect(server.flowDerivers).toEqual([peers]);
    expect(Object.isFrozen(server.flowDerivers)).toBe(true);
    expect(defineExtensionServer(vpn, {})).not.toHaveProperty('flowDerivers');
  });

  it('refuses two derivers with the same id in one extension', () => {
    expect(() => defineExtensionServer(vpn, { flowDerivers: [deriver('peers'), deriver('peers')] }))
      .toThrow(/peers/);
  });
});

describe('flow draft schema', () => {
  it('accepts a draft from a service or from a public or internal client', () => {
    const full: FlowDraft = {
      ...draft(),
      protocol: 'https',
      encrypted: true,
      hostnames: ['app.homelab.example', '*.dev.homelab.example'],
    };

    expect(flowDraftSchema.parse(full)).toEqual(full);
    expect(flowDraftSchema.safeParse(draft({ source: { client: 'public' } })).success).toBe(true);
    expect(flowDraftSchema.safeParse(draft({ source: { client: 'internal' } })).success).toBe(true);
  });

  it('refuses a draft with both sources or none', () => {
    expect(issuePaths(flowDraftSchema.safeParse(draft({ source: { serviceId: SERVICE_ID, client: 'public' } }))))
      .toEqual(['source']);
    expect(issuePaths(flowDraftSchema.safeParse(draft({ source: {} })))).toEqual(['source']);
    expect(issuePaths(flowDraftSchema.safeParse(draft({ source: { client: 'everyone' } })))).toEqual(['source']);
  });

  it('refuses unbounded fields: more than 50 hostnames or basis entries, an invalid hostname, key or id', () => {
    const many = Array.from({ length: 51 }, (_, index) => `host-${String(index)}.homelab.example`);

    expect(issuePaths(flowDraftSchema.safeParse(draft({
      key: 'x'.repeat(201),
      targetListenerId: 'not-an-id',
      hostnames: many,
      basis: Array.from({ length: 51 }, () => ({ entity: 'peer', id: SERVICE_ID })),
    })))).toEqual(['key', 'targetListenerId', 'hostnames', 'basis']);
    expect(issuePaths(flowDraftSchema.safeParse(draft({ hostnames: ['not a hostname'] })))).toEqual(['hostnames.0']);
    expect(issuePaths(flowDraftSchema.safeParse(draft({ basis: [{ entity: 'Peer!', id: SERVICE_ID }] }))))
      .toEqual(['basis.0.entity']);
  });

  it('refuses a result with more than 5,000 drafts or the same key twice', () => {
    const drafts = Array.from({ length: MAX_FLOW_DRAFTS + 1 }, (_, index) => draft({ key: `peer-${String(index)}` }));

    expect(flowDraftsSchema.safeParse(drafts.slice(0, 2)).success).toBe(true);
    expect(issuePaths(flowDraftsSchema.safeParse(drafts))).toEqual(['']);
    expect(issuePaths(flowDraftsSchema.safeParse([draft(), draft()]))).toEqual(['1.key']);
  });
});
