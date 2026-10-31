import { getExtensionDiagnostics, listExtensions } from './extensions';
import { getHealth, getOpenApiDocument } from './system';
import { getTrace } from './traces';
import { getTraffic } from './traffic';
import { listWorkspaces } from './workspaces';

import type { Contract } from './contract';

/** Every API operation. The OpenAPI document and the route consistency tests are built from this list. */
export const CONTRACTS: readonly Contract[] = [
  getHealth, getOpenApiDocument, listExtensions, getExtensionDiagnostics, listWorkspaces, getTrace, getTraffic,
];
