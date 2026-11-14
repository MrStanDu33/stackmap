import { createError, defineEventHandler } from 'h3';

import type { Contract } from '../../shared/contracts/contract';
import type { EventHandler } from 'h3';

export const ENTITY_METHODS = ['list', 'create', 'get', 'update', 'remove'] as const;

export type EntityMethod = (typeof ENTITY_METHODS)[number];

export type EntityHandler = EventHandler & { contracts: readonly Contract[] };

/**
 * The route of one method of the entity API: it finds the contract of the path's extension and entity, then behaves
 * like `defineContractHandler` with it.
 */
export function defineEntityHandler(method: EntityMethod): EntityHandler {
  const handler = defineEventHandler(() => {
    throw createError({ statusCode: 501, statusMessage: `Not implemented: ${method}` });
  });
  return Object.assign(handler, { contracts: [] });
}
