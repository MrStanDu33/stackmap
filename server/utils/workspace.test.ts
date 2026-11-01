import { describe, expectTypeOf, it } from 'vitest';

import { workspaceRepositories } from './workspace';

import type { AuthorizedWorkspace } from './contract-handler';

describe('workspaceRepositories', () => {
  it('takes only a workspace the membership check authorized, never a plain id', () => {
    expectTypeOf(workspaceRepositories).parameter(0).toEqualTypeOf<AuthorizedWorkspace>();
    // @ts-expect-error: an id and a role are not an authorized workspace.
    expectTypeOf(workspaceRepositories).toBeCallableWith({ id: '0199d6a0-0000-7000-8000-000000000001', role: 'owner' });
  });
});
