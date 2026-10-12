import { describe, expect, it } from 'vitest';

import { listenerSchema } from './listener';
import { issuePaths } from '../../tests/support/issues';

const SERVICE_ID = '0199d6a0-0000-7000-8000-000000000001';

const parse = (input: Record<string, unknown>) =>
  listenerSchema.input.safeParse({ serviceId: SERVICE_ID, port: 443, transport: 'tcp', ...input });

describe('listener schema', () => {
  it('requires a service, a port from 1 to 65535 and a transport tcp or udp', () => {
    expect(issuePaths(listenerSchema.input.safeParse({}))).toEqual(['serviceId', 'port', 'transport']);
    expect(parse({ port: 1 }).success).toBe(true);
    expect(parse({ port: 65_535, transport: 'udp' }).success).toBe(true);
    for (const port of [0, 65_536, 80.5]) {
      expect(issuePaths(parse({ port }))).toEqual(['port']);
    }
    expect(issuePaths(parse({ transport: 'sctp' }))).toEqual(['transport']);
    expect(issuePaths(parse({ protocol: 'Not Kebab' }))).toEqual(['protocol']);
  });

  it('defaults the bind address to 0.0.0.0, and accepts null for a port not bound on the host', () => {
    expect(parse({}).data).toMatchObject({ protocol: null, bindAddress: '0.0.0.0', publishedPort: null });
    expect(parse({ bindAddress: null }).data?.bindAddress).toBeNull();
    expect(parse({ bindAddress: '2001:DB8::20' }).data?.bindAddress).toBe('2001:db8::20');
    expect(issuePaths(parse({ bindAddress: 'eth0' }))).toEqual(['bindAddress']);
  });

  it('accepts a published port from 1 to 65535, or null', () => {
    expect(parse({ port: 80, publishedPort: 8080 }).data?.publishedPort).toBe(8080);
    expect(issuePaths(parse({ publishedPort: 70_000 }))).toEqual(['publishedPort']);
  });

  it('given a published port and no bind address, fails on bindAddress', () => {
    expect(issuePaths(parse({ publishedPort: 8080, bindAddress: null }))).toEqual(['bindAddress']);
  });
});
