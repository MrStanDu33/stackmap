import { createApp, toWebHandler } from 'h3';
import { describe, expect, it } from 'vitest';

import handler from './openapi.json.get';
import { createOpenApiDocument } from '../../shared/contracts/openapi';

const get = async (url: string, headers: Record<string, string> = {}) => {
  const response = await toWebHandler(createApp().use('/api/openapi.json', handler))(new Request(url, { headers }));
  return { status: response.status, json: await response.json() as Record<string, unknown> };
};

describe('GET /api/openapi.json', () => {
  it('serves the OpenAPI document generated from the contracts, with this instance\'s origin as its server', async () => {
    // Clients send the Host header; h3's test adapter does not derive it from the URL.
    const { status, json } = await get('http://stackmap.home.arpa:8080/api/openapi.json', {
      host: 'stackmap.home.arpa:8080',
    });

    expect(status).toBe(200);
    expect(json).toEqual({
      ...createOpenApiDocument(),
      servers: [{ url: 'http://stackmap.home.arpa:8080', description: 'This Stackmap instance' }],
    });
  });

  it('behind a reverse proxy, uses the origin the client called', async () => {
    const { json } = await get('http://127.0.0.1:3000/api/openapi.json', {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'stackmap.home.arpa',
    });

    expect(json.servers).toEqual([{ url: 'https://stackmap.home.arpa', description: 'This Stackmap instance' }]);
  });
});
