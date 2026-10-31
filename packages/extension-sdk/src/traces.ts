import { z } from 'zod';

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

export const traceHopsSchema: z.ZodType<TraceHop[]> = z.array(z.never()).max(MAX_TRACE_HOPS);
