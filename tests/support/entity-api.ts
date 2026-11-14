import { afterEach, beforeEach } from 'vitest';

import { createMember } from './accounts';
import { serveRoute } from './requests';
import { BUILTIN_REGISTRY, useTestWorkspaces } from './workspaces';
import { setDatabase } from '../../server/utils/database';
import { setExtensionRegistry } from '../../server/utils/extensions';
import { setSessionResolver } from '../../server/utils/session';

import type { Dialect } from './databases';
import type { TestWorkspaces } from './workspaces';
import type { Database } from '../../server/database/types/schema';
import type { Session } from '../../shared/contracts/auth';
import type { WorkspaceRole } from '../../shared/contracts/contract';
import type { EventHandler } from 'h3';
import type { Kysely } from 'kysely';

/** The Nitro routes of the entity API. */
export const ENTITIES_ROUTE = '/api/workspaces/:workspaceId/entities/:extension/:entity';
export const ENTITY_ROUTE = `${ENTITIES_ROUTE}/:entityId`;

/** An id no entity has. */
export const UNKNOWN_ID = '0199d6a0-0000-7000-8000-00000000dead';

export interface EntityApi {
  workspaces: TestWorkspaces;
  db: () => Kysely<Database>;
  /** Signs every following request in as a new member of workspace A (or B) with the role. */
  signInAs: (role: WorkspaceRole, of?: 'a' | 'b') => Promise<Session>;
  /** `/api/workspaces/<A>/entities/core/host[/<id>]`. */
  path: (type: string, id?: string, workspaceId?: string) => string;
}

/** The test workspaces, the built-in extensions and members by role, for the entity routes. */
export function useEntityApi(dialect: Dialect): EntityApi {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  let members = 0;

  beforeEach(() => {
    setDatabase(Promise.resolve(db()));
    setExtensionRegistry(BUILTIN_REGISTRY);
  });
  afterEach(() => {
    setSessionResolver();
  });

  return {
    workspaces,
    db,
    signInAs: async (role, of = 'a') => {
      members += 1;
      const session = await createMember(db(), workspaces[of].workspace.id, role, {
        name: `Member ${String(members)}`, email: `member-${String(members)}@homelab.example`,
      });
      setSessionResolver(() => Promise.resolve(session));
      return session;
    },
    path: (type, id, workspaceId = workspaces.a.workspace.id) =>
      `/api/workspaces/${workspaceId}/entities/${type}${id === undefined ? '' : `/${id}`}`,
  };
}

export const serveEntities = (method: 'get' | 'post', handler: EventHandler) => serveRoute(method, ENTITIES_ROUTE, handler);
export const serveEntity = (method: 'get' | 'patch' | 'delete', handler: EventHandler) =>
  serveRoute(method, ENTITY_ROUTE, handler);
