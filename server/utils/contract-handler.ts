import type { Contract } from '../../shared/contracts/contract';
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

/** A route handler that implements a contract: validated input in, a declared response out. */
// R is inferred from the handler (const keeps `status: 200` literal) and must be one of the declared responses.
export function defineContractHandler<C extends Contract, const R extends ContractResult<C>>(
  _contract: C,
  _handler: (input: ContractInput<C>, event: H3Event) => R | Promise<R>,
): ContractHandler<C> {
  throw new Error('Not implemented');
}
