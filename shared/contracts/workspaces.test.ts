import { describe, expect, it } from 'vitest';

import { CONTRACTS } from './index';
import { createOpenApiDocument } from './openapi';
import { listWorkspaces } from './workspaces';

describe('listWorkspaces contract', () => {
  it('is in CONTRACTS and documented under the Workspaces tag, with its 200 and 400 responses', () => {
    const operation = createOpenApiDocument().paths?.['/api/workspaces']?.get;

    expect(CONTRACTS).toContain(listWorkspaces);
    expect(operation?.tags).toEqual(['Workspaces']);
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['200', '400', '500']);
  });
});
