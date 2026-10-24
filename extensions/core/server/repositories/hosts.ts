import { cidrContains } from '@stackmap/extension-sdk/entities';
import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { hostSchema } from '../../entities';

import type { Host, HostAddress, HostFields, HostInput, HostPatch } from '../../entities';
import type { CoreDatabase } from '../types/schema';
import type { EntityIssue } from '@stackmap/extension-sdk/entities';
import type { EntityReference, RepositoryContext, ScopedRepository } from '@stackmap/extension-sdk/server';

export type HostRepository = ScopedRepository<Host, HostInput, HostPatch, { siteId?: string }>;

type Context = RepositoryContext<CoreDatabase>;

/** Addresses outside the CIDR of the network they are on. */
async function checkAddresses({ db, scope }: Context, { addresses }: HostFields): Promise<EntityIssue[]> {
  const networkIds = [...new Set(addresses.flatMap(({ networkId }) => (networkId ? [networkId] : [])))];
  if (networkIds.length === 0) {
    return [];
  }
  const networks = new Map((await db.selectFrom('core_network')
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
async function writeAddresses({ db, scope, newId }: Context, hostId: string, { addresses }: HostFields): Promise<void> {
  await db.deleteFrom('core_hostAddress')
    .where('workspaceId', '=', scope.workspaceId)
    .where('hostId', '=', hostId)
    .execute();
  if (addresses.length > 0) {
    // Ids are UUIDv7, so ordering by id gives the addresses back in this order.
    await db.insertInto('core_hostAddress').values(addresses.map(({ address, networkId }) => ({
      id: newId(),
      workspaceId: scope.workspaceId,
      hostId,
      networkId,
      address,
    }))).execute();
  }
}

type Row = Record<string, unknown>;

async function withAddresses({ db, scope }: Context, hosts: Row[]): Promise<Row[]> {
  const ids = hosts.map(({ id }) => id as string);
  const rows = ids.length === 0
    ? []
    : await db.selectFrom('core_hostAddress')
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

/** A host's addresses are stored in `core_hostAddress`; the database deletes them with the host. */
export const hostRepository = defineEntityRepository<HostFields, HostInput, CoreDatabase>({
  entity: 'host',
  key: 'hosts',
  table: 'core_host',
  schema: hostSchema,
  columns: ['name', 'kind', 'os', 'siteId'],
  ownedFields: ['addresses'],
  kinds: { kind: 'host' },
  filters: ['siteId'],
  references: ({ siteId, addresses }) => [
    ...(siteId ? [{ field: 'siteId', table: 'core_site', id: siteId }] : []),
    ...addresses.flatMap(({ networkId }, index): EntityReference[] =>
      (networkId ? [{ field: `addresses.${String(index)}.networkId`, table: 'core_network', id: networkId }] : [])),
  ],
  dependents: [{ entity: 'service', table: 'core_service', column: 'hostId' }],
  check: (context, host, changed) => (changed.has('addresses') ? checkAddresses(context, host) : Promise.resolve([])),
  writeOwned: (context, id, host, changed) =>
    (changed.has('addresses') ? writeAddresses(context, id, host) : Promise.resolve()),
  expand: withAddresses,
});
