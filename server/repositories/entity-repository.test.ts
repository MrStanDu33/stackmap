import { describe, expect, it } from 'vitest';

import { defineEntityRepository } from './entity-repository';
import { siteSchema } from '../../shared/entities';

const SET_BY_THE_REPOSITORY = ['id', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'];

describe('entity repository definitions', () => {
  it.each(SET_BY_THE_REPOSITORY)('refuses a definition that stores, filters or owns %s', (column) => {
    for (const key of ['columns', 'filters', 'ownedFields']) {
      const definition = { table: 'site', schema: siteSchema, columns: ['name'], [key]: ['name', column] };

      expect(() => defineEntityRepository(definition as never), key).toThrow(column);
    }
  });
});
