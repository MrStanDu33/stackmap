import type { Contract } from './contract';
import type { ExtensionManifest } from '@stackmap/extension-sdk';
import type { EntityRepositoryDefinition } from '@stackmap/extension-sdk/server';

/** The five operations of one entity type. */
export interface EntityContracts {
  list: Contract;
  create: Contract;
  get: Contract;
  update: Contract;
  remove: Contract;
}

/** `core` + `dns-record` → `CoreDnsRecord`, the stem of the entity's operation ids. */
export function entityOperationName(extension: string, entity: string): string {
  throw new Error(`Not implemented: ${extension} ${entity}`);
}

/** The operations of an entity type, generated from its repository definition and schemas. */
export function entityContracts(manifest: ExtensionManifest, definition: EntityRepositoryDefinition): EntityContracts {
  throw new Error(`Not implemented: ${manifest.id} ${definition.entity}`);
}

/** The operations of every entity of the built-in extensions. */
export const BUILTIN_ENTITY_CONTRACTS: readonly Contract[] = [];
