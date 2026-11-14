import { describe, expect, it } from 'vitest';

import { EntityInUseError, EntityValidationError } from './errors';
import { ProblemIssue } from '../../shared/contracts/errors';

describe('repository errors', () => {
  it('names the dependents of an entity in use, or says other entities when they are unknown', () => {
    expect(new EntityInUseError([{ entity: 'host', count: 2 }]).message).toContain('2 host');
    expect(new EntityInUseError([]).message).toBe('The entity is still used by other entities.');
  });

  it('keeps the values of an invalid entity out of its message, which logs may carry', () => {
    const error = new EntityValidationError([{
      path: 'addresses.0.address', message: '10.0.20.5 is not in LAN (10.0.10.0/24)', code: 'core.address-outside-network',
      params: { address: '10.0.20.5', network: 'LAN', cidr: '10.0.10.0/24' },
    }]);

    expect(error.message).toContain('addresses.0.address');
    expect(error.message).toContain('core.address-outside-network');
    expect(error.message).not.toContain('10.0.20.5');
    expect(error.message).not.toContain('LAN');
  });

  it('keeps the issues an extension\'s check returns within the bounds a Problem declares', () => {
    const params = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`p${String(index)}`, 'x'.repeat(600)]));
    const [issue] = new EntityValidationError([{ path: 'name', message: 'y'.repeat(1500), code: 'test.long', params }]).issues;

    expect(() => ProblemIssue.parse(issue)).not.toThrow();
  });
});
