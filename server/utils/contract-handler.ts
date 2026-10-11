import {
  defineEventHandler,
  getQuery,
  getRequestHeader,
  getRequestWebStream,
  getRouterParams,
  setResponseStatus,
} from 'h3';

import type { Contract } from '../../shared/contracts/contract';
import type { ApiError } from '../../shared/contracts/errors';
import type { EventHandler, H3Event } from 'h3';
import type { z } from 'zod';

/** Largest request body the API reads, in bytes. */
export const MAX_BODY_BYTES = 1024 * 1024;

type Parsed<S> = S extends z.ZodType ? z.output<S> : undefined;

/** The validated input of a contract's operation. */
export interface ContractInput<C extends Contract> {
  params: Parsed<C['params']>;
  query: Parsed<C['query']>;
  body: Parsed<C['body']>;
}

/** One of the responses the contract declares: its status and a body matching that status's schema. */
export type ContractResult<C extends Contract> = {
  [S in keyof C['responses'] & number]: { status: S; body: z.input<C['responses'][S]['schema']> };
}[keyof C['responses'] & number];

export type ContractHandler<C extends Contract> = EventHandler & { contract: C };

type Issue = NonNullable<z.output<typeof ApiError>['issues']>[number];

/** Thrown to answer with an API error instead of the handler's response. */
class ApiFailure extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string, readonly issues?: Issue[]) {
    super(message);
  }
}

const toIssues = (source: string, error: z.ZodError): Issue[] => error.issues.map((issue) => ({
  path: [source, ...issue.path.map(String)].join('.'),
  message: issue.message,
}));

const tooLarge = () =>
  new ApiFailure(413, 'payload_too_large', `The request body is larger than ${String(MAX_BODY_BYTES)} bytes.`);

/** Reads the body as text, stopping as soon as it goes over the limit instead of buffering all of it. */
async function readLimitedBody(event: H3Event): Promise<string> {
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > MAX_BODY_BYTES) {
    throw tooLarge();
  }
  const reader = (getRequestWebStream(event) as ReadableStream<Uint8Array> | undefined)?.getReader();
  if (!reader) {
    return '';
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      // Discard the rest, as Node does with unread bodies. Cancelling the stream instead would make h3's Node adapter
      // throw, outside the request, on the next chunk.
      event.node.req.removeAllListeners('data');
      event.node.req.resume();
      throw tooLarge();
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const isJson = (contentType: string) => {
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'application/json' || mediaType.endsWith('+json');
};

async function readJsonBody(event: H3Event): Promise<unknown> {
  // Only JSON: cross-site forms and simple fetches (text/plain, form data) are sent without a CORS preflight.
  const contentType = getRequestHeader(event, 'content-type');
  const unsupported = new ApiFailure(415, 'unsupported_media_type', 'The request body must be JSON (application/json).');
  if (contentType !== undefined && !isJson(contentType)) {
    throw unsupported;
  }
  const raw = await readLimitedBody(event);
  if (raw === '') {
    return undefined;
  }
  if (contentType === undefined) {
    throw unsupported;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiFailure(400, 'validation_failed', 'The request body is not valid JSON.', [
      { path: 'body', message: 'Invalid JSON' },
    ]);
  }
}

async function parseInput<C extends Contract>(contract: C, event: H3Event): Promise<ContractInput<C>> {
  const sources = {
    params: [contract.params, () => getRouterParams(event, { decode: true })],
    query: [contract.query, () => getQuery(event)],
    body: [contract.body, () => readJsonBody(event)],
  } as const;
  const input: Record<string, unknown> = {};
  const issues: Issue[] = [];
  for (const [source, [schema, read]] of Object.entries(sources)) {
    if (schema === undefined) {
      continue;
    }
    const result = schema.safeParse(await read());
    if (result.success) {
      input[source] = result.data;
    } else {
      issues.push(...toIssues(source, result.error));
    }
  }
  if (issues.length > 0) {
    throw new ApiFailure(400, 'validation_failed', 'The request does not match the API contract.', issues);
  }
  return input as unknown as ContractInput<C>;
}

/** Outside production, checks that the handler answered with a declared status and a body matching its schema. */
function checkResult(contract: Contract, { status, body }: { status: number; body: unknown }): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const declared = contract.responses[status];
  const result = declared?.schema.safeParse(body);
  if (result?.success !== true) {
    const issues = result ? toIssues('response', result.error) : [{ path: 'status', message: `Undeclared status ${String(status)}` }];
    console.error(`[api] ${contract.operationId} answered ${String(status)} with a response that does not match its contract`, issues);
    throw new ApiFailure(500, 'invalid_response', `The response of ${contract.operationId} does not match its contract.`, issues);
  }
}

/** A route handler that implements a contract: validated input in, a declared response out. */
// R is inferred from the handler (const keeps `status: 200` literal) and must be one of the declared responses.
export function defineContractHandler<C extends Contract, const R extends ContractResult<C>>(
  contract: C,
  handler: (input: ContractInput<C>, event: H3Event) => R | Promise<R>,
): ContractHandler<C> {
  const eventHandler = defineEventHandler(async (event) => {
    try {
      const result: { status: number; body: unknown } = await handler(await parseInput(contract, event), event);
      checkResult(contract, result);
      setResponseStatus(event, result.status);
      return result.body;
    } catch (error) {
      const failure = error instanceof ApiFailure ? error : new ApiFailure(500, 'internal_error', 'Something went wrong.');
      if (!(error instanceof ApiFailure)) {
        console.error(`[api] ${contract.operationId} failed`, error);
      }
      setResponseStatus(event, failure.statusCode);
      return {
        statusCode: failure.statusCode,
        code: failure.code,
        message: failure.message,
        ...(failure.issues === undefined ? {} : { issues: failure.issues }),
      } satisfies z.input<typeof ApiError>;
    }
  });
  return Object.assign(eventHandler, { contract });
}
