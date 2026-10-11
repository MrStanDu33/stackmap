import { defineEventHandler, getQuery, getRouterParams, readRawBody, setResponseStatus } from 'h3';

import type { Contract } from '../../shared/contracts/contract';
import type { ApiError } from '../../shared/contracts/errors';
import type { EventHandler, H3Event } from 'h3';
import type { z } from 'zod';

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

async function readJsonBody(event: H3Event): Promise<unknown> {
  const raw = await readRawBody(event, 'utf8');
  if (raw === undefined || raw === '') {
    return undefined;
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
