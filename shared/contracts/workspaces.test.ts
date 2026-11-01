import { describe, expect, it } from 'vitest';

import { CONTRACTS } from './index';
import { createOpenApiDocument } from './openapi';
import { createWorkspace, listWorkspaces } from './workspaces';

describe('workspace contracts', () => {
  it('lists the caller\'s workspaces under the Workspaces tag, for any session, with no input', () => {
    const operation = createOpenApiDocument().paths?.['/api/workspaces']?.get;

    expect(CONTRACTS).toContain(listWorkspaces);
    expect(operation?.tags).toEqual(['Workspaces']);
    expect(operation?.['x-required-role']).toBe('signedIn');
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['200', '401', '500']);
  });

  it('creates a workspace for the instance administrator, answering 201 or 409 for a taken slug', () => {
    const operation = createOpenApiDocument().paths?.['/api/workspaces']?.post;

    expect(CONTRACTS).toContain(createWorkspace);
    expect(operation?.['x-required-role']).toBe('instanceAdmin');
    expect(Object.keys(operation?.responses ?? {}).sort())
      .toEqual(['201', '400', '401', '403', '409', '413', '415', '500']);
  });
});
