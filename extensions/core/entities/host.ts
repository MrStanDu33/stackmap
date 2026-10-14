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
  name: entityName(),
  kind: kindId(),
  os: line(100).nullable().default(null),
  siteId: entityId().nullable().default(null),
  addresses: z.array(z.strictObject({ address: ipAddress(), networkId: entityId().nullable().default(null) }))
    .max(MAX_ADDRESSES)
    .default([]),
}, (host: HostFields, context) => {
  const seen = new Set<string>();
  host.addresses.forEach(({ address }, index) => {
    if (seen.has(address)) {
      context.addIssue({ code: 'custom', path: ['addresses', index, 'address'], message: `${address} is listed twice` });
    }
    seen.add(address);
  });
  return host;
});
