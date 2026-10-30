import { z } from 'zod';

import type { EntityRepositories } from './server';

/*
 * Flow derivers: an extension turns its entities into flows (a source → a listener). The server runs every active
 * extension's derivers after a write and stores what they return; a deriver only reads.
 */

/** Where traffic comes from when no documented service sends it: clients outside or inside, as DNS views. */
export const FLOW_CLIENTS = ['public', 'internal'] as const;
export type FlowClient = (typeof FLOW_CLIENTS)[number];

export const MAX_FLOW_DRAFTS = 5000;
export const MAX_FLOW_HOSTNAMES = 50;
export const MAX_FLOW_BASIS = 50;

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

export const flowDraftSchema: z.ZodType<FlowDraft> = z.never();

/** A deriver's whole result: bounded, with unique keys. */
export const flowDraftsSchema: z.ZodType<FlowDraft[]> = z.never();
