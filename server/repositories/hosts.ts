import { defineEntityRepository } from './entity-repository';
import { cidrContains, hostSchema } from '../../shared/entities';
import { newId } from '../database/ids';

import type { EntityReference, RepositoryContext, ScopedRepository } from './entity-repository';
import type { EntityIssue } from './errors';
import type { Host, HostAddress, HostFields, HostInput, HostPatch } from '../../shared/entities';

type HostFilter = { siteId?: string };

export type HostRepository = ScopedRepository<Host, HostInput, HostPatch, HostFilter>;

/** Addresses outside the CIDR of the network they are on. */
async function checkAddresses({ db, scope }: RepositoryContext, { addresses }: HostFields): Promise<EntityIssue[]> {
  const networkIds = [...new Set(addresses.flatMap(({ networkId }) => (networkId ? [networkId] : [])))];
  if (networkIds.length === 0) {
    return [];
  }
  const networks = new Map((await db.selectFrom('network')
    .select(['id', 'name', 'cidr'])
    .where('workspaceId', '=', scope.workspaceId)
    .where('id', 'in', networkIds)
    .execute()).map((network) => [network.id, network]));
  return addresses.flatMap(({ address, networkId }, index) => {
    const network = networkId ? networks.get(networkId) : undefined;
    return network?.cidr && !cidrContains(network.cidr, address)
      ? [{
          path: `addresses.${String(index)}.address`,
          message: `${address} is not in ${network.name} (${network.cidr})`,
        }]
      : [];
  });
}

/** Replaces the host's addresses, in their order. */
async function writeAddresses(
  { db, scope }: RepositoryContext,
  hostId: string,
  { addresses }: HostFields,
): Promise<void> {
  await db.deleteFrom('hostAddress').where('workspaceId', '=', scope.workspaceId).where('hostId', '=', hostId).execute();
  if (addresses.length > 0) {
    // Ids are UUIDv7, so ordering by id gives the addresses back in this order.
    await db.insertInto('hostAddress').values(addresses.map(({ address, networkId }) => ({
      id: newId(),
      workspaceId: scope.workspaceId,
      hostId,
      networkId,
      address,
    }))).execute();
  }
}

async function withAddresses<T extends { id?: unknown }>({ db, scope }: RepositoryContext, hosts: T[]): Promise<T[]> {
  const ids = hosts.map(({ id }) => id as string);
  const rows = ids.length === 0
    ? []
    : await db.selectFrom('hostAddress')
        .select(['hostId', 'address', 'networkId'])
        .where('workspaceId', '=', scope.workspaceId)
        .where('hostId', 'in', ids)
        .orderBy('id')
        .execute();
  const byHost = Map.groupBy(rows, ({ hostId }) => hostId);
  return hosts.map((host) => ({
    ...host,
    addresses: (byHost.get(host.id as string) ?? [])
      .map(({ address, networkId }): HostAddress => ({ address, networkId })),
  }));
}

/** A host's addresses are stored in `hostAddress`; the database deletes them with the host. */
export const hostRepository = defineEntityRepository<Host, HostFields, HostInput, HostPatch, HostFilter>({
  table: 'host',
  schema: hostSchema,
  columns: ['name', 'kind', 'os', 'siteId'],
  ownedFields: ['addresses'],
  kinds: { kind: 'host' },
  filters: ['siteId'],
  references: ({ siteId, addresses }) => [
    ...(siteId ? [{ field: 'siteId', table: 'site', id: siteId } as const] : []),
    ...addresses.flatMap(({ networkId }, index): EntityReference[] =>
      (networkId ? [{ field: `addresses.${String(index)}.networkId`, table: 'network', id: networkId }] : [])),
  ],
  dependents: [{ table: 'service', column: 'hostId' }],
  check: (context, host, changed) => (changed.has('addresses') ? checkAddresses(context, host) : Promise.resolve([])),
  writeOwned: (context, id, host, changed) =>
    (changed.has('addresses') ? writeAddresses(context, id, host) : Promise.resolve()),
  expand: withAddresses,
});
