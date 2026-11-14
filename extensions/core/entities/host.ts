import { defineEntitySchema, entityId, entityName, ipAddress, kindId, line } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from '@stackmap/extension-sdk/entities';

/** An IP address of a host, on a network when it is known. */
export interface HostAddress {
  address: string;
  networkId: string | null;
}

export interface HostFields extends CommonFields {
  name: string;
  /** A `host` kind of an active extension. */
  kind: string;
  os: string | null;
  siteId: string | null;
  addresses: HostAddress[];
}

export type Host = EntityMeta & HostFields;
export type HostInput = CommonInput & {
  name: string;
  kind: string;
  os?: string | null;
  siteId?: string | null;
  addresses?: { address: string; networkId?: string | null }[];
};
export type HostPatch = Partial<HostInput>;

const MAX_ADDRESSES = 32;

export const hostSchema: EntitySchema<HostFields, HostInput> = defineEntitySchema({
  name: entityName().meta({ description: 'The host\'s name', examples: ['nas'] }),
  kind: kindId().meta({ description: 'The host kind, from an active extension', examples: ['physical'] }),
  os: line(100).nullable().default(null).meta({ description: 'The operating system', examples: ['Debian 13'] }),
  siteId: entityId().nullable().default(null).meta({ description: 'The site the host is in', examples: ['0199d6a0-0000-7000-8000-000000000001'] }),
  addresses: z.array(z.strictObject({
    address: ipAddress().meta({ description: 'An IPv4 or IPv6 address of the host, normalized', examples: ['192.0.2.10'] }),
    networkId: entityId().nullable().default(null).meta({
      description: 'The network the address is in', examples: ['0199d6a0-0000-7000-8000-000000000006'],
    }),
  }))
    .max(MAX_ADDRESSES)
    .default([])
    .meta({ description: 'The host\'s addresses, each once', examples: [[{ address: '192.0.2.10', networkId: null }]] }),
}, (host: HostFields, context) => {
  const seen = new Set<string>();
  host.addresses.forEach(({ address }, index) => {
    if (seen.has(address)) {
      context.addIssue({ code: 'custom', path: ['addresses', index, 'address'], message: `${address} is listed twice`, params: { code: 'core.duplicate-address', address } });
    }
    seen.add(address);
  });
  return host;
});
