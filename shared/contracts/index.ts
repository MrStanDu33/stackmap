import { listExtensions } from './extensions';
import { getHealth, getOpenApiDocument } from './system';

import type { Contract } from './contract';

/** Every API operation. The OpenAPI document and the route consistency tests are built from this list. */
export const CONTRACTS: readonly Contract[] = [getHealth, getOpenApiDocument, listExtensions];
