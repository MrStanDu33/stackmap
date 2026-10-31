import type { Translate } from './traffic-graph';
import type { Trace, TraceStep } from '../../shared/contracts/traces';

type Hop = TraceStep['hops'][number];

/** What is selected in the Trace view: the client, a listener or a step. */
export interface TraceSelection {
  type: 'client' | 'listener' | 'step';
  id: string;
}

/** Lookups over a trace: request steps, dependencies by depth, steps into and out of a listener. */
export function indexTrace(_trace: Trace): {
  request: TraceStep[];
  dependencies: [number, TraceStep[]][];
  entries: number;
  step: (id: string) => TraceStep | undefined;
  listener: (id: string) => Extract<Trace['nodes'][number], { type: 'listener' }>['listener'] | undefined;
  stepsInto: (listenerId: string) => TraceStep[];
  stepsFrom: (listenerId: string) => TraceStep[];
} {
  throw new Error('Not implemented');
}

/** A hop as its extension's translated sentence; a fallback when its label has no translation. */
export function hopSentence(_hop: Hop, _t: Translate, _exists: (key: string) => boolean): string {
  throw new Error('Not implemented');
}
