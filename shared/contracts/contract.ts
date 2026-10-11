import type { z } from 'zod';

/** Who may call an operation; enforced from phase 4 (authentication). */
export type Role = 'public' | 'viewer' | 'editor' | 'admin' | 'owner';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ContractResponse {
  description: string;
  schema: z.ZodType;
}

/** An API operation: its route, documentation, access and schemas. Route handlers implement exactly one. */
export interface Contract {
  method: HttpMethod;
  /** Nitro-style path, with `:param` placeholders. */
  path: `/api/${string}`;
  operationId: string;
  summary: string;
  description?: string;
  tags: readonly string[];
  requiredRole: Role;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  responses: Readonly<Record<number, ContractResponse>>;
}

export class ContractError extends Error {
  override name = 'ContractError';
}

/** Checks a contract's documentation at definition time and returns it unchanged, with its literal types. */
export function defineContract<const C extends Contract>(_contract: C): C {
  throw new Error('Not implemented');
}
