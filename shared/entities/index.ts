import { dnsRecordSchema } from './dns-record';
import { domainSchema } from './domain';
import { hostSchema } from './host';
import { listenerSchema } from './listener';
import { networkSchema } from './network';
import { serviceSchema } from './service';
import { siteSchema } from './site';

export * from './common';
export * from './dns-record';
export * from './domain';
export * from './host';
export * from './listener';
export * from './network';
export * from './network-values';
export * from './service';
export * from './site';
export * from './workspace';

/** The schemas of every core entity. */
export const ENTITY_SCHEMAS = {
  site: siteSchema,
  network: networkSchema,
  host: hostSchema,
  service: serviceSchema,
  listener: listenerSchema,
  domain: domainSchema,
  dnsRecord: dnsRecordSchema,
} as const;
