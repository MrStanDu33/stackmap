import { portLabel } from './traffic-index';

import type { Translate } from './traffic-graph';
import type { Trace, TraceNode, TraceStep } from '../../shared/contracts/traces';

type Hop = TraceStep['hops'][number];
type Listener = Extract<TraceNode, { type: 'listener' }>['listener'];

/** What is selected in the Trace view: the client, a listener or a step. */
export interface TraceSelection {
  type: 'client' | 'listener' | 'step';
  id: string;
}

/** Lookups over a trace: request steps, dependencies by depth, steps into and out of a listener. */
export function indexTrace(trace: Trace) {
  const listeners = new Map(trace.nodes.flatMap((node) => (node.type === 'listener' ? [[node.id, node.listener]] : [])));
  const request = trace.steps.filter(({ role }) => role === 'request');
  const byDepth = Map.groupBy(trace.steps.filter(({ role }) => role === 'dependency'), ({ depth }) => depth);
  return {
    request,
    dependencies: [...byDepth.entries()].toSorted(([a], [b]) => a - b),
    entries: request.filter(({ source }) => source === 'client').length,
    step: (id: string) => trace.steps.find((step) => step.id === id),
    listener: (id: string): Listener | undefined => listeners.get(id),
    stepsInto: (listenerId: string) => trace.steps.filter(({ target }) => target === listenerId),
    stepsFrom: (listenerId: string) => trace.steps.filter(({ source }) => source === listenerId),
  };
}

export type TraceIndex = ReturnType<typeof indexTrace>;

/** `Nginx Proxy Manager 443/tcp`. */
export const listenerName = (listener: Listener) => `${listener.serviceName} ${portLabel(listener)}`;

/** Where a step starts: the client, or a listener's service. */
const sourceName = (index: TraceIndex, trace: Trace, { source }: TraceStep, t: Translate) => (source === 'client'
  ? t(`traffic.client.${trace.client}`)
  : index.listener(source)?.serviceName ?? '');

/** "From Internet to Nginx Proxy Manager, port 443/tcp", with its level for a dependency and its target for a cycle. */
export function stepName(index: TraceIndex, trace: Trace, step: TraceStep, t: Translate): string {
  const target = index.listener(step.target);
  const name = t('trace.step', {
    source: sourceName(index, trace, step, t), service: target?.serviceName ?? '', port: target ? portLabel(target) : '',
  });
  if (step.cycle) {
    return t('trace.cycle', { step: name, target: target ? listenerName(target) : '' });
  }
  return step.role === 'dependency' ? t('trace.dependencyStep', { step: name, depth: step.depth }) : name;
}

/** A hop as its extension's translated sentence; a fallback when its label has no translation. */
export function hopSentence(hop: Hop, t: Translate, exists: (key: string) => boolean): string {
  if (!exists(hop.label)) {
    return t('trace.hop.missing', { entity: hop.entity });
  }
  // The core's generic hops count entries: their count picks the plural form.
  const count = Number(hop.params.count);
  return Number.isInteger(count) ? t(hop.label, hop.params, count) : t(hop.label, hop.params);
}
