import { describe, expect, it } from 'vitest';

import { CONTRACTS } from './index';
import { createOpenApiDocument } from './openapi';
import { getTraffic } from './traffic';

describe('getTraffic contract', () => {
  it('is in CONTRACTS and documented under the Traffic tag, with its 200, 400 and 404 responses', () => {
    const operation = createOpenApiDocument().paths?.['/api/workspaces/{workspaceId}/traffic']?.get;

    expect(CONTRACTS).toContain(getTraffic);
    expect(operation?.tags).toEqual(['Traffic']);
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['200', '400', '404', '500']);
    expect(Object.keys((operation?.responses?.['404'] as { content?: object } | undefined)?.content ?? {}))
      .toEqual(['application/problem+json']);
  });
});
