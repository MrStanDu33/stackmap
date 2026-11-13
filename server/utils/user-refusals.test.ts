import { describe, expect, it } from 'vitest';

import { refusal } from './user-refusals';

describe('user refusals as problems', () => {
  it('answers 404 for an unknown account and 409 for the others (7, 9, 13)', () => {
    expect(refusal({ code: 'user_not_found' }, '/api/users/x')).toMatchObject({ status: 404, body: { code: 'user_not_found', instance: '/api/users/x' } });
    for (const code of ['cannot_demote_self', 'last_admin', 'cannot_remove_self'] as const) {
      expect(refusal({ code }, '/api/users/x')).toMatchObject({ status: 409, body: { code } });
    }
  });

  it('names the workspaces a sole owner would leave without an owner (14)', () => {
    const { body } = refusal({ code: 'last_owner', workspaces: ['Home lab', 'Office'] }, '/api/users/x');

    expect(body.detail).toBe('This account is the only owner of Home lab, Office. Add another owner first.');
    // For the page to say in its own language.
    expect(body.workspaces).toEqual(['Home lab', 'Office']);
  });

  it('keeps the detail within its limit for 100 long workspace names (review)', () => {
    const workspaces = Array.from({ length: 100 }, (_, n) => `${'W'.repeat(97)}${String(n).padStart(3, '0')}`);

    const { body } = refusal({ code: 'last_owner', workspaces }, '/api/users/x');

    expect(body.detail.length).toBeLessThanOrEqual(2000);
    expect(body.workspaces).toEqual(workspaces);
  });
});
