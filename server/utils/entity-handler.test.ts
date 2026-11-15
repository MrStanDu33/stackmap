import { describe, expect, it } from 'vitest';

import { defineEntityHandler, ENTITY_METHODS } from './entity-handler';
import { BUILTIN_ENTITY_CONTRACTS } from '../../shared/contracts/entities';

describe('entity handlers', () => {
  it('serves, per method, the built-in entity operations of that method on the generic route (1)', () => {
    const served = ENTITY_METHODS.flatMap((method) => defineEntityHandler(method).contracts);

    expect(served.length).toBeGreaterThan(0);
    expect(served.toSorted((a, b) => a.operationId.localeCompare(b.operationId)))
      .toEqual(BUILTIN_ENTITY_CONTRACTS.toSorted((a, b) => a.operationId.localeCompare(b.operationId)));
    expect(defineEntityHandler('list').contracts.every(({ method, path }) => method === 'get' && !path.endsWith(':entityId')))
      .toBe(true);
  });
});
