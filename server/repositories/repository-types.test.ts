import { describe, expectTypeOf, it } from 'vitest';

import type { WorkspaceRepositories } from './index';
import type { Host, HostInput } from '../../extensions/core/entities';
import type {} from '../../extensions/core/server/repositories';

describe('repository types', () => {
  it('types the core repositories through the augmentation: repos.hosts.create takes HostInput and returns Host', () => {
    expectTypeOf<WorkspaceRepositories['hosts']['create']>().parameter(0).toEqualTypeOf<HostInput>();
    expectTypeOf<WorkspaceRepositories['hosts']['create']>().returns.resolves.toEqualTypeOf<Host>();
  });
});
