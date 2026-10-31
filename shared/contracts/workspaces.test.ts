import { describe, expect, it } from 'vitest';

import { CONTRACTS } from './index';
import { createOpenApiDocument } from './openapi';
import { getWorkspaceBySlug } from './workspaces';

describe('getWorkspaceBySlug contract', () => {
  it('is in CONTRACTS and documented under the Workspaces tag, with its 200, 400 and 404 responses', () => {
    const operation = createOpenApiDocument().paths?.['/api/workspaces/by-slug/{slug}']?.get;

    expect(CONTRACTS).toContain(getWorkspaceBySlug);
    expect(operation?.tags).toEqual(['Workspaces']);
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['200', '400', '404', '500']);
    expect(Object.keys((operation?.responses?.['404'] as { content?: object } | undefined)?.content ?? {}))
      .toEqual(['application/problem+json']);
  });
});
