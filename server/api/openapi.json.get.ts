import { getRequestURL } from 'h3';

import { createOpenApiDocument } from '../../shared/contracts/openapi';
import { getOpenApiDocument, OpenApiDocument } from '../../shared/contracts/system';
import { defineContractHandler } from '../utils/contract-handler';

// Parsed once with its own response schema: typed like it, and checked when the server starts.
const document = OpenApiDocument.parse(createOpenApiDocument());

/** The document, with this instance as its server, so "Try it" in /api/docs calls the instance it reads. */
export default defineContractHandler(getOpenApiDocument, (_input, event) => {
  // Behind a reverse proxy, the origin the client called (X-Forwarded-Proto and X-Forwarded-Host).
  const { origin } = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });
  const servers = [{ url: origin, description: 'This Stackmap instance' }];
  return { status: 200, body: { ...document, servers } };
});
