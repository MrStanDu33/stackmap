import { getTrace } from '#shared/contracts/traces';

/** A trace to show: what the form submits and the URL holds. */
export interface TraceQuery {
  hostname: string;
  client: 'public' | 'internal';
  port: number | null;
}

/** The i18n key of each invalid field's error. */
export type TraceQueryErrors = Partial<Record<'hostname' | 'port', string>>;

/** Reads a trace query from the URL or the form, with the trace route's own rules. */
export function parseTraceQuery(raw: Record<string, unknown>): { query: TraceQuery | null; errors: TraceQueryErrors } {
  const hostname = typeof raw.hostname === 'string' ? raw.hostname.trim() : '';
  if (!hostname) {
    return { query: null, errors: {} };
  }
  const port = raw.port === undefined || raw.port === null || raw.port === '' ? undefined : raw.port;
  // An unknown client falls back to the Internet, as the route does.
  const client = raw.client === 'internal' ? 'internal' : 'public';
  const parsed = getTrace.query.safeParse({ hostname, client, port });
  if (parsed.success) {
    const { hostname: name, client: from, port: only } = parsed.data;
    return { query: { hostname: name, client: from, port: only ?? null }, errors: {} };
  }
  const errors: TraceQueryErrors = {};
  for (const { path } of parsed.error.issues) {
    if (path[0] === 'hostname') {
      errors.hostname = hostname.includes('*') ? 'trace.form.error.wildcard' : 'trace.form.error.hostname';
    } else if (path[0] === 'port') {
      errors.port = 'trace.form.error.port';
    }
  }
  return { query: null, errors };
}
