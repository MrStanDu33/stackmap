import { describe, expect, it } from 'vitest';

import { defineExtensionServer } from './hooks';
import { MAX_TRACE_HOP_PARAMS, MAX_TRACE_HOPS, traceHopsSchema } from './traces';
import { issuePaths } from '../../../tests/support/issues';

import type { ExtensionManifest } from './manifest';
import type { TraceHop, TraceHopResolver } from './traces';

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

const PEER_ID = '0199d6a0-0000-7000-8000-000000000001';

const resolver = (entity: string): TraceHopResolver => ({ entity, resolve: () => Promise.resolve([]) });

const hop = (overrides: Record<string, unknown> = {}) => ({
  entity: 'peer',
  id: PEER_ID,
  stage: 'network',
  label: 'extensions.vpn.trace.peer',
  params: { peer: 'Laptop' },
  ...overrides,
});

describe('trace hop resolvers', () => {
  it('given traceHopResolvers, defineExtensionServer keeps them frozen with the extension', () => {
    const peers = resolver('peer');

    const server = defineExtensionServer(vpn, { traceHopResolvers: [peers] });

    expect(server.traceHopResolvers).toEqual([peers]);
    expect(Object.isFrozen(server.traceHopResolvers)).toBe(true);
    expect(defineExtensionServer(vpn, {})).not.toHaveProperty('traceHopResolvers');
  });

  it('given two resolvers for the same entity in one extension, defineExtensionServer refuses them', () => {
    expect(() => defineExtensionServer(vpn, { traceHopResolvers: [resolver('peer'), resolver('peer')] }))
      .toThrow(/peer/);
  });
});

describe('traceHopsSchema', () => {
  it('refuses an unknown stage, more than 10 params, an unbounded value or more than 50 hops', () => {
    const valid: TraceHop = { ...hop(), stage: 'network', port: 51820 };
    const params = Object.fromEntries(Array.from({ length: MAX_TRACE_HOP_PARAMS + 1 }, (_, n) => [`p${String(n)}`, 'x']));

    expect(traceHopsSchema.safeParse([valid, hop({ stage: 'dns' }), hop({ stage: 'proxy' })]).success).toBe(true);
    expect(issuePaths(traceHopsSchema.safeParse([hop({ stage: 'tunnel' })]))).toEqual(['0.stage']);
    expect(issuePaths(traceHopsSchema.safeParse([hop({ params })]))).toEqual(['0.params']);
    expect(issuePaths(traceHopsSchema.safeParse([hop({ params: { peer: 'x'.repeat(201) } })]))).toEqual(['0.params.peer']);
    expect(issuePaths(traceHopsSchema.safeParse([hop({ port: 70_000 })]))).toEqual(['0.port']);
    expect(traceHopsSchema.safeParse(Array.from({ length: MAX_TRACE_HOPS + 1 }, () => hop())).success).toBe(false);
  });
});
