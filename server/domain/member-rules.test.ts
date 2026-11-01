import { describe, expect, it } from 'vitest';

import { canManage } from './member-rules';
import { WORKSPACE_ROLES } from '../../shared/contracts/contract';

const LOWER = new Set(['viewer', 'editor']);

describe('canManage', () => {
  it('lets an admin manage editors and viewers and grant only those roles; an owner manages and grants every role (2, 14, 15)', () => {
    for (const target of [null, ...WORKSPACE_ROLES]) {
      for (const granted of [undefined, ...WORKSPACE_ROLES]) {
        const label = `${String(target)} → ${String(granted)}`;
        expect(canManage('owner', target, granted), `owner: ${label}`).toBe(true);
        const adminMay = (target === null || LOWER.has(target)) && (granted === undefined || LOWER.has(granted));
        expect(canManage('admin', target, granted), `admin: ${label}`).toBe(adminMay);
      }
    }
  });

  it('lets no editor or viewer manage anyone', () => {
    for (const actor of ['viewer', 'editor'] as const) {
      for (const target of [null, ...WORKSPACE_ROLES]) {
        for (const granted of [undefined, ...WORKSPACE_ROLES]) {
          expect(canManage(actor, target, granted), `${actor}: ${String(target)} → ${String(granted)}`).toBe(false);
        }
      }
    }
  });
});
