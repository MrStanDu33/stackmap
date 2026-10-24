import { describe, expect, it } from 'vitest';

import { createEntityRepository } from './entity-repository';
import { siteSchema } from '../../extensions/core/entities';

const SET_BY_THE_REPOSITORY = ['id', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'];

describe('entity repository definitions', () => {
  it.each(SET_BY_THE_REPOSITORY)('refuses a definition that stores, filters or owns %s', (column) => {
    for (const key of ['columns', 'filters', 'ownedFields']) {
      const definition = {
        entity: 'site', key: 'sites', table: 'core_site', schema: siteSchema, columns: ['name'], [key]: ['name', column],
      };

      expect(() => createEntityRepository(definition as never), key).toThrow(column);
    }
  });
});
