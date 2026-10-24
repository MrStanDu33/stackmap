import { describe, expect, it } from 'vitest';

import { EntityInUseError } from './errors';

describe('repository errors', () => {
  it('names the dependents of an entity in use, or says other entities when they are unknown', () => {
    expect(new EntityInUseError([{ entity: 'host', count: 2 }]).message).toContain('2 host');
    expect(new EntityInUseError([]).message).toBe('The entity is still used by other entities.');
  });
});
