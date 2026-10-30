import { z } from 'zod';

import { entityId } from './entities/common';
import { normalizeDnsName } from './entities/network-values';
import { kebabId, line } from './formats';

import type { EntityRepositories } from './server';

/*
 * Flow derivers: an extension turns its entities into flows (a source → a listener). The server runs every active
 * extension's derivers after a write and stores what they return; a deriver only reads.
 */

/** Where traffic comes from when no documented service sends it: clients outside or inside, as DNS views. */
export const FLOW_CLIENTS = ['public', 'internal'] as const;
export type FlowClient = (typeof FLOW_CLIENTS)[number];

export const MAX_FLOW_DRAFTS = 5000;
export const MAX_FLOW_HOSTNAMES = 1000;
export const MAX_FLOW_BASIS = 1000;

/** An entity a flow was derived from. */
export interface FlowBasis {
  entity: string;
  id: string;
}

export type FlowSource = { serviceId: string } | { client: FlowClient };

/** A flow as a deriver returns it. */
export interface FlowDraft {
  /** Stable for the same flow from one run to the next, unique in the deriver's result. */
  key: string;
  source: FlowSource;
  targetListenerId: string;
  protocol?: string | null;
  encrypted?: boolean | null;
  hostnames?: string[];
  basis: FlowBasis[];
}

type ReadOnly<R> = R extends { get: infer Get; list: infer List } ? { get: Get; list: List } : never;

/** The active extensions' repositories of one workspace, to read only. */
export type FlowReader = { readonly [K in keyof EntityRepositories]: ReadOnly<EntityRepositories[K]> };

export interface FlowDeriver {
  /** Kebab-case, unique in its extension. */
  id: string;
  derive: (context: { read: FlowReader }) => Promise<readonly FlowDraft[]>;
}

/** A lowercase DNS name as derivers give it, `*` allowed as the first label. */
const hostname = () => z.string().max(255).refine((text) => {
  const name = text.startsWith('*.') ? text.slice(2) : text;
  return normalizeDnsName(name) === name;
}, 'Expected a lowercase hostname, such as app.homelab.example or *.homelab.example');

export const flowDraftSchema: z.ZodType<FlowDraft> = z.strictObject({
  key: line(200).min(1),
  source: z.union([z.strictObject({ serviceId: entityId() }), z.strictObject({ client: z.enum(FLOW_CLIENTS) })]),
  targetListenerId: entityId(),
  protocol: kebabId().nullable().optional(),
  encrypted: z.boolean().nullable().optional(),
  hostnames: z.array(hostname()).max(MAX_FLOW_HOSTNAMES).optional(),
  basis: z.array(z.strictObject({ entity: kebabId(), id: entityId() })).max(MAX_FLOW_BASIS),
});

/** A deriver's whole result: bounded, with unique keys. */
export const flowDraftsSchema: z.ZodType<FlowDraft[]> = z.array(flowDraftSchema).max(MAX_FLOW_DRAFTS)
  .superRefine((drafts, context) => {
    const keys = new Set<string>();
    drafts.forEach(({ key }, index) => {
      if (keys.has(key)) {
        context.addIssue({ code: 'custom', path: [index, 'key'], message: `${key} is returned twice` });
      }
      keys.add(key);
    });
  });
