import { getTrace } from '#shared/contracts/traces';

/** A trace to show: what the form submits and the URL holds. */
export interface TraceQuery {
  hostname: string;
  client: 'public' | 'internal';
  port: number | null;
}

/** The i18n key of each invalid field's error. */
export type TraceQueryErrors = Partial<Record<'hostname' | 'port', string>>;

const inRange = (port: string) => Number(port) >= 1 && Number(port) <= 65535;

/** Reads a trace query from the URL or the form, with the trace route's own rules. */
export function parseTraceQuery(raw: Record<string, unknown>): { query: TraceQuery | null; errors: TraceQueryErrors } {
  const hostname = typeof raw.hostname === 'string' ? raw.hostname.trim() : '';
  const typed = typeof raw.port === 'number' ? String(raw.port) : raw.port;
  const port = typeof typed === 'string' && typed.trim() !== '' ? typed.trim() : undefined;
  // Digits only: the contract would read "4a3" as no number, and "1e3" as 1000.
  const portError = port !== undefined && !/^\d{1,5}$/.test(port);
  if (!hostname) {
    return { query: null, errors: portError || (port !== undefined && !inRange(port)) ? { port: 'trace.form.error.port' } : {} };
  }
  if (portError) {
    const { errors } = parseTraceQuery({ ...raw, port: undefined });
    return { query: null, errors: { ...errors, port: 'trace.form.error.port' } };
  }
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
