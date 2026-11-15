import { describe } from 'vitest';

import { itDocumentsEntities } from '../../../tests/support/entity-documentation';
import server from '../server';

describe('reverse-proxy entity schemas as API documentation', () => {
  itDocumentsEntities(server, [import.meta.dirname]);
});
