import type { TraceIndex, TraceSelection } from './trace-index';

/** `?selected=` as a selection, when it names something in the trace. */
export const parseSelected = (_raw: unknown, _index: TraceIndex): TraceSelection | null => null;

/** A selection as `?selected=`: `step:<id>`, `listener:<id>` or `client`. */
export const selectedParam = (_selection: TraceSelection | null): string | undefined => undefined;
