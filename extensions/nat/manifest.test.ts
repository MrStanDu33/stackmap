import { describe, expect, it } from 'vitest';

import nat from './manifest';

describe('nat manifest', () => {
  it('declares the port-forward entity on nat_portForward, with every label under extensions.nat.', () => {
    expect(nat.contributes.entities).toEqual([
      { id: 'port-forward', table: 'nat_portForward', label: 'extensions.nat.entities.port-forward' },
    ]);
    expect([nat.name, nat.description]).toEqual(['extensions.nat.name', 'extensions.nat.description']);
  });
});

describe('nat manifest: onboarding', () => {
  it('asks its onboarding question under extensions.nat.onboarding (3)', () => {
    expect(nat.onboarding).toBe('extensions.nat.onboarding');
  });
});
