import { createApp, toWebHandler } from 'h3';
import { describe, expect, it } from 'vitest';

import handler from './openapi.json.get';
import { createOpenApiDocument } from '../../shared/contracts/openapi';

describe('GET /api/openapi.json', () => {
  it('serves the OpenAPI document generated from the contracts', async () => {
    const response = await toWebHandler(createApp().use('/api/openapi.json', handler))(
      new Request('http://localhost/api/openapi.json'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(createOpenApiDocument());
  });
});
