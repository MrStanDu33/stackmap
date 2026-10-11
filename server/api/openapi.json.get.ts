import { createOpenApiDocument } from '../../shared/contracts/openapi';
import { getOpenApiDocument } from '../../shared/contracts/system';
import { defineContractHandler } from '../utils/contract-handler';

// zod-openapi types the document with interfaces, which TypeScript does not treat as the contract's open JSON
// objects; spreading them into plain objects does.
const document = createOpenApiDocument();
const body = { ...document, info: { ...document.info }, paths: { ...document.paths } };

export default defineContractHandler(getOpenApiDocument, () => ({ status: 200, body }));
