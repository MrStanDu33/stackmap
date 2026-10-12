import { getRequestURL } from 'h3';

import { createOpenApiDocument } from '../../shared/contracts/openapi';
import { getOpenApiDocument } from '../../shared/contracts/system';
import { defineContractHandler } from '../utils/contract-handler';

// zod-openapi types the document with interfaces, which TypeScript does not treat as the contract's open JSON
// objects; spreading them into plain objects does.
const document = createOpenApiDocument();
const body = { ...document, info: { ...document.info }, paths: { ...document.paths } };

/** The document, with this instance as its server, so "Try it" in /api/docs calls the instance it reads. */
export default defineContractHandler(getOpenApiDocument, (_input, event) => {
  // Behind a reverse proxy, the origin the client called (X-Forwarded-Proto and X-Forwarded-Host).
  const { origin } = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });
  return { status: 200, body: { ...body, servers: [{ url: origin, description: 'This Stackmap instance' }] } };
});
