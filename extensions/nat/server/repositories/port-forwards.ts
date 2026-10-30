import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { portForwardSchema } from '../../entities';

import type { PortForward, PortForwardFields, PortForwardInput, PortForwardPatch } from '../../entities';
import type { NatDatabase } from '../types/schema';
import type { EntityIssue } from '@stackmap/extension-sdk/entities';
import type { RepositoryContext, ScopedRepository } from '@stackmap/extension-sdk/server';

export type PortForwardRepository = ScopedRepository<
  PortForward, PortForwardInput, PortForwardPatch, { hostId?: string }
>;

/** The external address is one of the host's. */
async function checkPortForward(
  { db, scope }: RepositoryContext<NatDatabase>, forward: PortForwardFields, changed: ReadonlySet<string>,
): Promise<EntityIssue[]> {
  if (!changed.has('hostId') && !changed.has('externalAddress')) {
    return [];
  }
  const held = await db.selectFrom('core_hostAddress').select('id')
    .where('workspaceId', '=', scope.workspaceId)
    .where('hostId', '=', forward.hostId)
    .where('address', '=', forward.externalAddress)
    .executeTakeFirst();
  return held ? [] : [{ path: 'externalAddress', message: `${forward.externalAddress} is not an address of this host` }];
}

/** A host's forwards belong to it: the database deletes them with it. */
export const portForwardRepository = defineEntityRepository<PortForwardFields, PortForwardInput, NatDatabase>({
  entity: 'port-forward',
  key: 'portForwards',
  table: 'nat_portForward',
  schema: portForwardSchema,
  columns: ['hostId', 'externalAddress', 'externalPort', 'transport', 'internalAddress', 'internalPort', 'description'],
  filters: ['hostId'],
  // The unique index covers the host, address, port and transport; the port is the field a form shows it on.
  unique: ['externalPort'],
  references: ({ hostId }) => [{ field: 'hostId', table: 'core_host', id: hostId }],
  check: checkPortForward,
});
