import type { TraceIndex, TraceSelection } from './trace-index';

/** `?selected=` as a selection, when it names something in the trace. */
export function parseSelected(raw: unknown, index: TraceIndex): TraceSelection | null {
  if (raw === 'client') {
    return { type: 'client', id: 'client' };
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const separator = raw.indexOf(':');
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
