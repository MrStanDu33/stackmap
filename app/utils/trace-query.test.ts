import { describe, expect, it } from 'vitest';

import { parseTraceQuery } from './trace-query';

describe('parseTraceQuery', () => {
  it('reads a valid query from the URL, lower-casing the hostname and defaulting to the Internet with no port', () => {
    expect(parseTraceQuery({ hostname: 'APP.Homelab.Example' }))
      .toEqual({ query: { hostname: 'app.homelab.example', client: 'public', port: null }, errors: {} });
    expect(parseTraceQuery({ hostname: 'npm.homelab.example', client: 'internal', port: '81' }).query)
      .toEqual({ hostname: 'npm.homelab.example', client: 'internal', port: 81 });
  });

  it('reports each invalid field, by the error the form shows, and no query', () => {
    expect(parseTraceQuery({})).toEqual({ query: null, errors: {} });
    expect(parseTraceQuery({ hostname: '*.homelab.example', port: '0' }))
      .toEqual({ query: null, errors: { hostname: 'trace.form.error.wildcard', port: 'trace.form.error.port' } });
    expect(parseTraceQuery({ hostname: 'bad_label.example' }).errors).toEqual({ hostname: 'trace.form.error.hostname' });
    expect(parseTraceQuery({ hostname: 'app.homelab.example', client: 'vpn' }).query?.client).toBe('public');
  });

  it('checks the port even without a hostname, and refuses anything but digits', () => {
    expect(parseTraceQuery({ port: '0' })).toEqual({ query: null, errors: { port: 'trace.form.error.port' } });
    expect(parseTraceQuery({ hostname: 'app.homelab.example', port: '4a3' }).errors)
      .toEqual({ port: 'trace.form.error.port' });
    expect(parseTraceQuery({ hostname: 'app.homelab.example', port: '443' }).query?.port).toBe(443);
  });
});
