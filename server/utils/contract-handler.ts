import {
  defineEventHandler,
  getQuery,
  getRequestHeader,
  getRequestURL,
  getRequestWebStream,
  getRouterParams,
  setResponseHeader,
  setResponseStatus,
} from 'h3';

import { MAX_ISSUES, problemOf } from '../../shared/contracts/errors';

import type { Contract } from '../../shared/contracts/contract';
import type { Problem, ProblemCode } from '../../shared/contracts/errors';
import type { EventHandler, H3Event } from 'h3';
import type { z } from 'zod';

const INTERNAL_ERROR = 'An unexpected error happened; the server logs have the details.';

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

type Issue = NonNullable<Problem['issues']>[number];

/** Thrown to answer with an API problem instead of the handler's response. */
class ApiFailure extends Error {
  readonly issues?: Issue[];

  constructor(readonly code: ProblemCode, detail: string, issues?: Issue[]) {
    // A bounded answer: at most MAX_ISSUES issues, and the detail says how many there were.
    super(issues && issues.length > MAX_ISSUES
      ? `${detail} Showing the first ${String(MAX_ISSUES)} of ${String(issues.length)} issues.`
      : detail);
    if (issues) {
      this.issues = issues.slice(0, MAX_ISSUES);
    }
  }
}

const toIssues = (source: string, error: z.ZodError): Issue[] => error.issues.map((issue) => ({
  path: [source, ...issue.path.map(String)].join('.'),
  message: issue.message,
}));

const tooLarge = () =>
  new ApiFailure('payload_too_large', `The request body is larger than ${String(MAX_BODY_BYTES)} bytes.`);

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
  const unsupported = new ApiFailure('unsupported_media_type', 'The request body must be JSON (application/json).');
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
    throw new ApiFailure('validation_failed', 'The request body is not valid JSON.', [
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
    throw new ApiFailure('validation_failed', 'The request does not match the API contract.', issues);
  }
  return input as unknown as ContractInput<C>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Paths of the fields the handler sent that its response schema dropped: fields the contract does not declare. */
function undeclaredFields(sent: unknown, parsed: unknown, path: string[] = []): string[] {
  if (Array.isArray(sent) && Array.isArray(parsed)) {
    return sent.flatMap((item, index) => undeclaredFields(item, parsed[index], [...path, String(index)]));
  }
  if (isRecord(sent) && isRecord(parsed)) {
    return Object.entries(sent).flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }
      return key in parsed ? undeclaredFields(value, parsed[key], [...path, key]) : [[...path, key].join('.')];
    });
  }
  return [];
}

/**
 * The body to send: the response parsed with its schema, so a field the contract does not declare (a password hash
 * a query selected by mistake) never leaves the server. Outside production, an undeclared field or a body that does
 * not match fails with `invalid_response`, so contract drift fails in tests; in production, a body that does not match
 * is never sent unvalidated.
 */
function responseBody(contract: Contract, { status, body }: { status: number; body: unknown }): unknown {
  const production = process.env.NODE_ENV === 'production';
  const declared = contract.responses[status];
  const result = declared?.schema.safeParse(body);
  const issues = !result
    ? [{ path: 'status', message: `Undeclared status ${String(status)}` }]
    : result.success
      ? undeclaredFields(body, result.data).map((path) => ({ path: `response.${path}`, message: 'Undeclared field' }))
      : toIssues('response', result.error);
  if (issues.length === 0 && result?.success) {
    return result.data;
  }
  const answered = `${contract.operationId} answered ${String(status)}`;
  console.error(`[api] ${answered} with a response that does not match its contract`, issues);
  if (production && result?.success) {
    return result.data;
  }
  if (production) {
    throw new ApiFailure('internal_error', INTERNAL_ERROR);
  }
  throw new ApiFailure('invalid_response', `The response of ${contract.operationId} does not match its contract.`, issues);
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
      const body = responseBody(contract, result);
      setResponseStatus(event, result.status);
      return body;
    } catch (error) {
      const failure = error instanceof ApiFailure
        ? error
        : new ApiFailure('internal_error', INTERNAL_ERROR);
      if (!(error instanceof ApiFailure)) {
        console.error(`[api] ${contract.operationId} failed`, error);
      }
      const problem = problemOf(failure.code, {
        detail: failure.message,
        instance: getRequestURL(event).pathname,
        ...(failure.issues === undefined ? {} : { issues: failure.issues }),
      });
      setResponseStatus(event, problem.status);
      setResponseHeader(event, 'content-type', 'application/problem+json');
      return problem;
    }
  });
  return Object.assign(eventHandler, { contract });
}
