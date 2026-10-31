/** A trace to show: what the form submits and the URL holds. */
export interface TraceQuery {
  hostname: string;
  client: 'public' | 'internal';
  port: number | null;
}

/** The i18n key of each invalid field's error. */
export type TraceQueryErrors = Partial<Record<'hostname' | 'port', string>>;

/** Reads a trace query from the URL or the form, with the trace route's own rules. */
export function parseTraceQuery(_raw: Record<string, unknown>): { query: TraceQuery | null; errors: TraceQueryErrors } {
  throw new Error('Not implemented');
}
