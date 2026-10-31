import { describe, expect, it } from 'vitest';

import { CONTRACTS } from './index';
import { createOpenApiDocument } from './openapi';
import { getTrace } from './traces';

describe('getTrace contract', () => {
  it('is in CONTRACTS and documented under the Traces tag, with its 200, 400 and 404 responses', () => {
    const operation = createOpenApiDocument().paths?.['/api/workspaces/{workspaceId}/trace']?.get;

    expect(CONTRACTS).toContain(getTrace);
    expect(operation?.tags).toEqual(['Traces']);
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['200', '400', '401', '404', '500']);
    expect(Object.keys((operation?.responses?.['404'] as { content?: object } | undefined)?.content ?? {}))
      .toEqual(['application/problem+json']);
  });
});
