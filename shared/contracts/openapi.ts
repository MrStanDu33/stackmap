import { CONTRACTS } from './index';

import type { Contract } from './contract';
import type { oas31 } from 'zod-openapi';

/** The OpenAPI 3.1 document of the given contracts. */
export function createOpenApiDocument(_contracts: readonly Contract[] = CONTRACTS): oas31.OpenAPIObject {
  throw new Error('Not implemented');
}
