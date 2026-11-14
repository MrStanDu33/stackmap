import { isExtensionTable } from '@stackmap/extension-sdk';
import { defineEventHandler, getRequestURL, getRouterParam, setResponseHeader } from 'h3';
import { z } from 'zod';

import { serveContract } from './contract-handler';
import { useExtensionRegistry } from './extensions';
import { workspaceRepositories } from './workspace';
import { BUILTIN_ENTITY_OPERATIONS } from '../../shared/contracts/entities';
import { MAX_ISSUES, problemOf } from '../../shared/contracts/errors';
import {
  EntityChangedError, EntityConflictError, EntityInUseError, EntityValidationError, WorkspaceReferenceError,
} from '../repositories/errors';

import type { AuthorizedWorkspace, ContractInput } from './contract-handler';
import type { Session } from '../../shared/contracts/auth';
import type { Contract } from '../../shared/contracts/contract';
import type { Problem, ProblemCode } from '../../shared/contracts/errors';
import type { RegisteredRepository } from '../extensions/registry';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';
import type { EventHandler, H3Event } from 'h3';

export const ENTITY_METHODS = ['list', 'create', 'get', 'update', 'remove'] as const;

export type EntityMethod = (typeof ENTITY_METHODS)[number];

export type EntityHandler = EventHandler & { contracts: readonly Contract[] };

type Repository = ScopedRepository<Record<string, unknown>, unknown, unknown, Record<string, unknown>>;

type Answer = { status: number; body: unknown };

const SUCCESS: Record<EntityMethod, number> = { list: 200, create: 201, get: 200, update: 200, remove: 204 };

const typeOf = (event: H3Event) => ({
  extension: getRouterParam(event, 'extension', { decode: true }) ?? '',
  entity: getRouterParam(event, 'entity', { decode: true }) ?? '',
});

/** The repository definition of the path's entity type, if an active extension declares it. */
const definitionOf = (event: H3Event): RegisteredRepository | undefined => {
  const { extension, entity } = typeOf(event);
  return useExtensionRegistry().repositories()
    .find((candidate) => candidate.extension === extension && candidate.entity === entity);
};

/** Only the declared fields, whatever their values: the repository checks those, so a broken rule is a 422. */
const fieldsOnly = (schema: z.ZodType | undefined) => {
  const object = schema instanceof z.ZodPipe ? schema.in : schema;
  return object instanceof z.ZodObject
    ? z.strictObject(Object.fromEntries(Object.keys(object.shape).map((field) => [field, z.unknown().optional()])))
    : schema;
};

/** An entity as the API sends it: dates as ISO strings, without the workspace the path already names. */
const toBody = ({ workspaceId: _workspaceId, ...entity }: Record<string, unknown>) => Object.fromEntries(
  Object.entries(entity).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
);

const problem = (event: H3Event, code: ProblemCode, detail: string, extra: Partial<Problem> = {}): Answer => {
  const body = problemOf(code, { detail, instance: getRequestURL(event).pathname, ...extra });
  return { status: body.status, body };
};

/** The extension whose table holds a dependent's rows. */
const extensionOf = (definition: RegisteredRepository, entity: string): string => {
  const table = definition.dependents?.find((dependent) => dependent.entity === entity)?.table ?? '';
  const extensions = new Set(useExtensionRegistry().repositories().map(({ extension }) => extension));
  return [...extensions].find((extension) => isExtensionTable(extension, table)) ?? definition.extension;
};

/** The expected failures of a write, as the Problem Details its contract declares. */
function failure(event: H3Event, definition: RegisteredRepository, error: unknown): Answer {
  if (error instanceof EntityValidationError) {
    const issues = error.issues.map((issue) => ({ ...issue, path: ['body', issue.path].filter(Boolean).join('.') }));
    const shown = issues.length > MAX_ISSUES ? ` Showing the first ${String(MAX_ISSUES)} of ${String(issues.length)}.` : '';
    return problem(event, 'entity_invalid', `The entity is invalid.${shown}`, { issues: issues.slice(0, MAX_ISSUES) });
  }
  if (error instanceof WorkspaceReferenceError) {
    return problem(event, 'reference_invalid', error.message, { field: error.field });
  }
  if (error instanceof EntityConflictError) {
    return problem(event, 'entity_conflict', error.message, { fields: error.fields });
  }
  if (error instanceof EntityInUseError) {
    return problem(event, 'entity_in_use', error.message, {
      dependents: error.dependents.slice(0, MAX_ISSUES)
        .map(({ entity, count }) => ({ extension: extensionOf(definition, entity), entity, count })),
    });
  }
  if (error instanceof EntityChangedError) {
    return problem(event, 'entity_changed', error.message);
  }
  throw error;
}

type Input = Omit<ContractInput<Contract>, 'workspace' | 'session'> & {
  workspace: AuthorizedWorkspace;
  session: Session;
  params: { entityId?: string };
  query: Record<string, unknown> & { limit: number; offset: number };
};

async function run(
  method: EntityMethod,
  input: Input,
  event: H3Event,
  definition: RegisteredRepository,
): Promise<Answer> {
  const repos = await workspaceRepositories(input.workspace, input.session);
  const repository = (repos as unknown as Record<string, Repository>)[definition.key] as Repository;
  const notFound = () => problem(event, 'entity_not_found', `No ${definition.entity} with this id in the workspace.`);
  const id = input.params.entityId ?? '';
  try {
    switch (method) {
      case 'list': {
        const { limit, offset, ...filter } = input.query;
        const [items, total] = await Promise.all([
          repository.list(filter, { limit, offset }), repository.count(filter),
        ]);
        return { status: SUCCESS.list, body: { items: items.map(toBody), total, limit, offset } };
      }
      case 'create': {
        const created = await repository.create(input.body);
        setResponseHeader(event, 'location', `${getRequestURL(event).pathname}/${String(created.id)}`);
        return { status: SUCCESS.create, body: toBody(created) };
      }
      case 'get': {
        const found = await repository.get(id);
        return found ? { status: SUCCESS.get, body: toBody(found) } : notFound();
      }
      case 'update': {
        const updated = await repository.update(id, input.body ?? {});
        return updated ? { status: SUCCESS.update, body: toBody(updated) } : notFound();
      }
      case 'remove':
        return await repository.remove(id) ? { status: SUCCESS.remove, body: null } : notFound();
    }
  } catch (error) {
    return failure(event, definition, error);
  }
}

/**
 * The route of one method of the entity API: it finds the contract of the path's extension and entity, then behaves
 * like `defineContractHandler` with it.
 */
export function defineEntityHandler(method: EntityMethod): EntityHandler {
  const contracts = [...BUILTIN_ENTITY_OPERATIONS.values()].map((operations) => operations[method]);
  const handler = defineEventHandler((event) => {
    const { extension, entity } = typeOf(event);
    const operations = BUILTIN_ENTITY_OPERATIONS.get(`${extension}/${entity}`);
    // Who calls is checked first, with the role every type shares for this method; then whether the type is active.
    const contract = operations?.[method] ?? contracts[0];
    if (!contract) {
      throw new Error('No entity operations.');
    }
    return serveContract(event, contract, (input) => {
      const definition = operations && definitionOf(event);
      return (definition
        ? run(method, input as unknown as Input, event, definition)
        : problem(event, 'entity_type_not_found', 'No active extension declares this entity type.'));
    }, {
      // An unknown type reads no body: its fields are unknown too.
      body: operations ? fieldsOnly(contract.body) : undefined,
    });
  });
  return Object.assign(handler, { contracts });
}
