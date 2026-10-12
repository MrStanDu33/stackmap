import type { z } from 'zod';

/** Who may call an operation; enforced from phase 4 (authentication). */
export type Role = 'public' | 'viewer' | 'editor' | 'admin' | 'owner';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ContractResponse {
  description: string;
  schema: z.ZodType;
  /** Named examples (at least one), shown in the API reference and checked against the schema by the lint. */
  examples: Readonly<Record<string, { summary: string; value: unknown }>>;
}

/** An API operation: its route, documentation, access and schemas. Route handlers implement exactly one. */
export interface Contract {
  method: HttpMethod;
  /** Nitro-style path, with `:param` placeholders. */
  path: `/api/${string}`;
  operationId: string;
  summary: string;
  /** What the operation does and when to use it; the required role is added to it in the API reference. */
  description: string;
  /** Tags declared in tags.ts. */
  tags: readonly string[];
  requiredRole: Role;
  /** The operation will go away: the API reference says so. */
  deprecated?: true;
  externalDocs?: { description: string; url: string };
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  responses: Readonly<Record<number, ContractResponse>>;
}

export class ContractError extends Error {
  override name = 'ContractError';
}

const isBlank = (text: unknown) => typeof text !== 'string' || text.trim() === '';

/** Checks a contract's documentation at definition time and returns it unchanged, with its literal types. */
export function defineContract<const C extends Contract>(contract: C): C {
  const missing = [
    isBlank(contract.summary) ? 'a summary' : null,
    isBlank(contract.description) ? 'a description' : null,
    contract.tags.length === 0 ? 'a tag' : null,
    Object.keys(contract.responses).length === 0 ? 'a response' : null,
    ...Object.entries(contract.responses)
      .filter(([, response]) => Object.keys((response as Partial<ContractResponse>).examples ?? {}).length === 0)
      .map(([status]) => `an example for its ${status} response`),
  ].filter((item) => item !== null);
  if (missing.length > 0) {
    throw new ContractError(`Contract ${contract.operationId} needs ${missing.join(', ')}.`);
  }
  return contract;
}
