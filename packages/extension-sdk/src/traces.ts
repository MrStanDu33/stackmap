import { z } from 'zod';

import { entityId, port } from './entities/common';
import { i18nKey, kebabId, text } from './formats';

import type { FlowReader } from './flows';

/*
 * Trace hop resolvers: an extension describes the entities a flow came from (its basis) as the hops of a trace. The
 * core walks the stored flows; a resolver only reads.
 */

/** Where a hop sits in a request: name resolution, then the network, then proxies. */
export const TRACE_STAGES = ['dns', 'network', 'proxy'] as const;
export type TraceStage = (typeof TRACE_STAGES)[number];

export const MAX_TRACE_HOPS = 50;
export const MAX_TRACE_HOP_PARAMS = 10;

/** One hop of a trace step, as a resolver returns it. */
export interface TraceHop {
  /** The basis entity it describes, kebab-case. */
  entity: string;
  id: string;
  stage: TraceStage;
  /** i18n key of its description. */
  label: string;
  /** Values the label interpolates. */
  params: Record<string, string>;
  /** The port a client connects to at this hop, such as a port forward's external port. */
  port?: number;
}

export interface TraceHopResolver {
  /** The basis entity it describes; one resolver per entity across the active extensions. */
  entity: string;
  /** Hops for the given basis ids of one flow, keeping only what concerns the traced hostname. */
  resolve: (context: { hostname: string; ids: readonly string[]; read: FlowReader }) => Promise<readonly TraceHop[]>;
}

/** Whether a hostname pattern serves a name: the name itself, or a wildcard over the names below its base. */
export const servesHostname = (pattern: string, hostname: string): boolean =>
  pattern === hostname || (pattern.startsWith('*.') && hostname.endsWith(pattern.slice(1)));

export const traceHopSchema: z.ZodType<TraceHop> = z.strictObject({
  entity: kebabId(),
  id: entityId(),
  stage: z.enum(TRACE_STAGES),
  label: i18nKey(),
  params: z.record(z.string().max(40).regex(/^[A-Za-z][\w-]*$/), text(200))
    .refine((params) => Object.keys(params).length <= MAX_TRACE_HOP_PARAMS, `At most ${String(MAX_TRACE_HOP_PARAMS)} params`),
  port: port().optional(),
});

/** A resolver's whole result for one call: bounded. */
export const traceHopsSchema: z.ZodType<TraceHop[]> = z.array(traceHopSchema).max(MAX_TRACE_HOPS);
