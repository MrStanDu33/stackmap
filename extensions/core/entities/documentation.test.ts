import { join } from 'node:path';

import { describe } from 'vitest';

import { itDocumentsEntities } from '../../../tests/support/entity-documentation';
import server from '../server';

describe('core entity schemas as API documentation', () => {
  // The common fields and their custom checks come from the SDK.
  itDocumentsEntities(server, [import.meta.dirname, join(import.meta.dirname, '../../../packages/extension-sdk/src/entities')]);
});
