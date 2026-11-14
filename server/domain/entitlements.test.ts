import { describe, expect, it } from 'vitest';

import { can } from './entitlements';

describe('entitlements', () => {
  it('given any workspace and feature, allows it in v1 (17)', () => {
    expect(can({ id: '0199d6a0-0000-7000-8000-000000000001' }, 'any-feature')).toBe(true);
    expect(can({ id: '0199d6a0-0000-7000-8000-000000000002' }, 'another-one')).toBe(true);
  });
});
