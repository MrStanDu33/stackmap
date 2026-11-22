import type { TraceIndex, TraceSelection } from './trace-index';
import type { Trace } from '../../shared/contracts/traces';

/** `?selected=` as a selection, when it names something in the trace. */
export function parseSelected(raw: unknown, index: TraceIndex): TraceSelection | null {
  if (raw === 'client') {
    return { type: 'client', id: 'client' };
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const separator = raw.indexOf(':');
  if (separator === -1) {
    return null;
  }
  const type = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  if (type === 'step' && index.step(id)) {
    return { type, id };
  }
  return type === 'listener' && index.listener(id) ? { type, id } : null;
}

/** A selection as `?selected=`: `step:<id>`, `listener:<id>` or `client`. */
export const selectedParam = (selection: TraceSelection | null): string | undefined => {
  if (!selection) {
    return undefined;
  }
  return selection.type === 'client' ? 'client' : `${selection.type}:${selection.id}`;
};

/** What the trace draws that the palette can select: each hop's entity to its first step, each port to itself. */
export function traceDrawn(trace: Trace): Record<string, string> {
  const drawn: Record<string, string> = {};
  for (const step of trace.steps) {
    for (const { id } of step.hops) {
      drawn[id] ??= `step:${step.id}`;
    }
  }
  for (const node of trace.nodes) {
    if (node.type === 'listener') {
      drawn[node.id] = `listener:${node.id}`;
    }
  }
  return drawn;
}
