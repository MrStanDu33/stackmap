import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { problem } from './auth';
import { defineContract } from './contract';
import { Problem, problemOf } from './errors';
import { text } from './formats';
import { timestamp } from './workspaces';
import coreEn from '../../extensions/core/i18n/locales/en.json';
import natEn from '../../extensions/nat/i18n/locales/en.json';
import reverseProxyEn from '../../extensions/reverse-proxy/i18n/locales/en.json';
import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from '../../server/extensions/builtin';

import type { Contract } from './contract';
import type { TagDocs } from './tags';
import type { ExtensionManifest } from '@stackmap/extension-sdk';
import type { EntityRepositoryDefinition } from '@stackmap/extension-sdk/server';

/** The five operations of one entity type. */
export interface EntityContracts {
  list: Contract;
  create: Contract;
  get: Contract;
  update: Contract;
  remove: Contract;
}

/** Most entities one page lists, and the default. */
export const MAX_PAGE = 1000;
export const DEFAULT_PAGE = 100;
export const MAX_OFFSET = 1_000_000;

const WORKSPACE_ID = '0199d6a0-0000-7000-8000-000000000001';
const ENTITY_ID = '0199d6a0-0000-7000-8000-000000000010';
const USER_ID = '0199d6a0-0000-7000-8000-000000000101';
const AT = '2026-11-14T09:00:00.000Z';

/** The English name and description of each built-in extension, for its tag in the API reference. */
const ENGLISH: Readonly<Record<string, { name: string; description: string }>> = {
  core: coreEn.extensions.core,
  nat: natEn.extensions.nat,
  'reverse-proxy': reverseProxyEn.extensions['reverse-proxy'],
};

const englishOf = (manifest: ExtensionManifest) => {
  const english = ENGLISH[manifest.id];
  if (!english) {
    throw new Error(`No English name for the ${manifest.id} extension's API tag.`);
  }
  return english;
};

/** The tag of an extension's entity operations: its English name. */
export const extensionTag = (manifest: ExtensionManifest): string => englishOf(manifest).name;

const pascal = (id: string) => id.split('-').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join('');

/** `core` + `dns-record` → `CoreDnsRecord`, the stem of the entity's operation ids. */
export function entityOperationName(extension: string, entity: string): string {
  return `${pascal(extension)}${pascal(entity)}`;
}

/** The fields of an entity schema: the object under its refine. */
const shapeOf = (schema: z.ZodType): Record<string, z.ZodType> => {
  const object = schema instanceof z.ZodPipe ? schema.in : schema;
  if (!(object instanceof z.ZodObject)) {
    throw new Error('An entity input schema is an object, or an object piped into a refine.');
  }
  return object.shape;
};

/**
 * The schema without its refines, recursively, its description kept. A response is written by the server, so a refine
 * there checks nothing a request did not; and the response lint reads one as a loose custom schema.
 */
export function withoutRefines(schema: z.ZodType): z.ZodType {
  const def = schema._zod.def as unknown as Record<string, unknown> & { checks?: unknown[] };
  const strip = (value: unknown): unknown => (value instanceof z.ZodType ? withoutRefines(value) : value);
  const changed: Record<string, unknown> = {
    ...def,
    ...(def.checks ? { checks: def.checks.filter((check) => !(check instanceof z.ZodCustom)) } : {}),
  };
  for (const key of ['innerType', 'element', 'in', 'out', 'keyType', 'valueType']) {
    if (key in def) {
      changed[key] = strip(def[key]);
    }
  }
  if (Array.isArray(def.options)) {
    changed.options = def.options.map(strip);
  }
  if (schema instanceof z.ZodObject) {
    const shape = Object.fromEntries(Object.entries(schema.shape).map(([key, field]) => [key, strip(field)]));
    Object.defineProperty(changed, 'shape', { value: shape, enumerable: true });
  }
  const copy = schema.clone(changed as never);
  const meta = schema.meta();
  return meta ? copy.meta(meta) : copy;
}

const exampleOf = (field: z.ZodType): unknown => (field.meta() as { examples?: unknown[] } | undefined)?.examples?.[0];

/** An entity as the API returns it: its fields, then the ones the repository sets. */
function entityResponse(manifest: ExtensionManifest, definition: EntityRepositoryDefinition, label: string) {
  const shape = shapeOf(definition.schema.input);
  const example = {
    id: ENTITY_ID,
    ...Object.fromEntries(Object.entries(shape).map(([field, schema]) => [field, exampleOf(schema)])),
    createdBy: USER_ID,
    updatedBy: USER_ID,
    createdAt: AT,
    updatedAt: AT,
  };
  const schema = z.object({
    id: entityId().meta({ description: 'Its id', examples: [ENTITY_ID] }),
    ...Object.fromEntries(Object.entries(shape).map(([field, fieldSchema]) => [field, withoutRefines(fieldSchema)])),
    createdBy: text(100).nullable()
      .meta({ description: 'Who created it, null for the system or once the account is gone', examples: [USER_ID] }),
    updatedBy: text(100).nullable()
      .meta({ description: 'Who last changed it, null for the system or once the account is gone', examples: [USER_ID] }),
    createdAt: timestamp().meta({ description: 'When it was created', examples: [AT] }),
    updatedAt: timestamp().meta({ description: 'When it last changed', examples: [AT] }),
  }).meta({ id: entityOperationName(manifest.id, definition.entity), description: `A ${label}`, examples: [example] });
  return { schema, example };
}

/** The operations of an entity type, generated from its repository definition and schemas. */
export function entityContracts(manifest: ExtensionManifest, definition: EntityRepositoryDefinition): EntityContracts {
  const name = entityOperationName(manifest.id, definition.entity);
  const label = definition.entity.replaceAll('-', ' ');
  // shortcut: plurals add an s, which every built-in entity takes; a manifest field when one does not.
  const plural = `${label}s`;
  const path = `/api/workspaces/:workspaceId/entities/${manifest.id}/${definition.entity}` as const;
  const instance = path.replace(':workspaceId', WORKSPACE_ID);
  const itemInstance = `${instance}/${ENTITY_ID}`;
  const tags = [extensionTag(manifest)];
  const { schema: entity, example } = entityResponse(manifest, definition, label);
  const input = Object.fromEntries(Object.keys(shapeOf(definition.schema.input)).map((field) => [
    field, example[field as keyof typeof example],
  ]));

  const workspaceParams = z.object({
    workspaceId: entityId().meta({ description: 'The workspace\'s id', examples: [WORKSPACE_ID] }),
  });
  const entityParams = workspaceParams.extend({
    // Any text: a malformed id is an entity the workspace does not have (404), as for an id of another workspace.
    entityId: text(100).meta({ description: `The ${label}'s id`, examples: [ENTITY_ID] }),
  });
  const filters = Object.fromEntries((definition.filters ?? []).map((field) => [
    field,
    entityId().optional().meta({ description: `Only the ${plural} with this ${field}`, examples: [WORKSPACE_ID] }),
  ]));

  const ok = (description: string, value: unknown, schema: z.ZodType = entity) =>
    ({ description, schema, examples: { [definition.entity]: { summary: description, value } } });
  const notFound = {
    description: `No ${label} with this id in the workspace, no such entity type, or a workspace the caller cannot open`,
    schema: Problem,
    examples: {
      entity_not_found: {
        summary: `No such ${label}`,
        value: problemOf('entity_not_found', { detail: `No ${label} with this id in the workspace.`, instance: itemInstance }),
      },
      workspace_not_found: {
        summary: 'No such workspace',
        value: problemOf('workspace_not_found', { detail: 'No workspace with this id that you can open.', instance: itemInstance }),
      },
    },
  };
  const typeNotFound = problem(
    'No active extension declares this entity type, or a workspace the caller cannot open',
    'entity_type_not_found',
    'No active extension declares this entity type.',
    instance,
  );
  const invalid = {
    description: 'The entity breaks one of its rules, or a reference points outside the workspace',
    schema: Problem,
    examples: {
      entity_invalid: {
        summary: 'A rule is broken',
        value: problemOf('entity_invalid', {
          detail: 'The entity is invalid.',
          instance,
          issues: [{
            path: 'body.name', message: 'Too small: expected string to have >=1 characters', code: 'too_small',
            params: { minimum: 1, origin: 'string' },
          }],
        }),
      },
      reference_invalid: {
        summary: 'A reference points outside the workspace',
        value: problemOf('reference_invalid', {
          detail: 'A reference points to an entity that is not in this workspace.', instance, field: 'siteId',
        }),
      },
    },
  };
  const conflict = (changed: boolean) => ({
    description: changed
      ? 'Another entity has the same unique values, or the entity changed while this write was checked'
      : 'Another entity has the same unique values',
    schema: Problem,
    examples: {
      entity_conflict: {
        summary: 'Already taken',
        value: problemOf('entity_conflict', {
          detail: 'Another entity already has the same name.', instance, fields: ['name'],
        }),
      },
      ...(changed
        ? {
            entity_changed: {
              summary: 'Changed meanwhile',
              value: problemOf('entity_changed', {
                detail: 'The entity changed since it was read; reload it and try again.', instance: itemInstance,
              }),
            },
          }
        : {}),
    },
  });

  return {
    list: defineContract({
      method: 'get',
      path,
      operationId: `list${name}s`,
      summary: `List the ${plural}`,
      description: `The workspace's ${plural}, in creation order, one page at a time; \`total\` counts every match.`,
      tags,
      requiredRole: 'viewer',
      params: workspaceParams,
      query: z.strictObject({
        limit: z.coerce.number().pipe(z.number().int().min(1).max(MAX_PAGE)).default(DEFAULT_PAGE)
          .meta({ description: `How many to return, at most ${String(MAX_PAGE)}`, examples: [DEFAULT_PAGE] }),
        offset: z.coerce.number().pipe(z.number().int().min(0).max(MAX_OFFSET)).default(0)
          .meta({ description: 'How many to skip', examples: [0] }),
        ...filters,
      }),
      responses: {
        200: ok(`One page of ${plural}`, { items: [example], total: 1, limit: DEFAULT_PAGE, offset: 0 }, z.object({
          items: z.array(entity).max(MAX_PAGE).meta({ description: `The ${plural} of the page` }),
          total: z.number().int().min(0).meta({ description: 'How many match, on every page', examples: [1] }),
          limit: z.number().int().min(1).max(MAX_PAGE).meta({ description: 'The page size', examples: [DEFAULT_PAGE] }),
          offset: z.number().int().min(0).max(MAX_OFFSET).meta({ description: 'How many were skipped', examples: [0] }),
        }).meta({
          id: `${name}Page`,
          description: `A page of ${plural}`,
          examples: [{ items: [example], total: 1, limit: DEFAULT_PAGE, offset: 0 }],
        })),
        404: typeNotFound,
      },
    }),
    create: defineContract({
      method: 'post',
      path,
      operationId: `create${name}`,
      summary: `Create a ${label}`,
      description: `Adds a ${label} to the workspace; \`Location\` points to it.`,
      tags,
      requiredRole: 'editor',
      params: workspaceParams,
      body: definition.schema.input.meta({ description: `The ${label}'s fields`, examples: [input] }),
      responses: {
        201: ok(`The ${label}, created`, example),
        404: typeNotFound,
        409: conflict(false),
        422: invalid,
      },
    }),
    get: defineContract({
      method: 'get',
      path: `${path}/:entityId`,
      operationId: `get${name}`,
      summary: `Read a ${label}`,
      description: `One ${label} of the workspace.`,
      tags,
      requiredRole: 'viewer',
      params: entityParams,
      responses: { 200: ok(`The ${label}`, example), 404: notFound },
    }),
    update: defineContract({
      method: 'patch',
      path: `${path}/:entityId`,
      operationId: `update${name}`,
      summary: `Change a ${label}`,
      description: `Changes the given fields of a ${label}; the others stay. \`null\` clears a field that allows it.`,
      tags,
      requiredRole: 'editor',
      params: entityParams,
      body: definition.schema.patch.meta({ description: 'The fields to change', examples: [input] }),
      responses: {
        200: ok(`The ${label}, changed`, example),
        404: notFound,
        409: conflict(true),
        422: invalid,
      },
    }),
    remove: defineContract({
      method: 'delete',
      path: `${path}/:entityId`,
      operationId: `remove${name}`,
      summary: `Remove a ${label}`,
      description: `Removes a ${label} nothing refers to.`,
      tags,
      requiredRole: 'editor',
      params: entityParams,
      responses: {
        204: { description: 'Removed', schema: z.null(), examples: { removed: { summary: 'Removed', value: null } } },
        404: notFound,
        409: problem(
          'Other entities refer to it; `dependents` says which',
          'entity_in_use',
          'The entity is still used by 2 service.',
          itemInstance,
        ),
      },
    }),
  };
}

/** The built-in extensions' repository definitions, with their manifest. */
const BUILTIN_DEFINITIONS = BUILTIN_EXTENSIONS.flatMap((manifest) =>
  (BUILTIN_EXTENSION_SERVERS.find(({ extension }) => extension === manifest.id)?.repositories ?? [])
    .map((definition) => ({ manifest, definition })));

/** The operations of each built-in entity type, by `<extension>/<entity>`. */
export const BUILTIN_ENTITY_OPERATIONS: ReadonlyMap<string, EntityContracts> = new Map(BUILTIN_DEFINITIONS.map(
  ({ manifest, definition }) => [`${manifest.id}/${definition.entity}`, entityContracts(manifest, definition)],
));

/** The operations of every entity of the built-in extensions. */
export const BUILTIN_ENTITY_CONTRACTS: readonly Contract[] = [...BUILTIN_ENTITY_OPERATIONS.values()]
  .flatMap(({ list, create, get, update, remove }) => [list, create, get, update, remove]);

/** The tags of the built-in extensions that have entities. */
export const ENTITY_TAGS: Readonly<Record<string, TagDocs>> = Object.fromEntries(
  [...new Set(BUILTIN_DEFINITIONS.map(({ manifest }) => manifest))]
    .map((manifest) => [extensionTag(manifest), { description: `${englishOf(manifest).description} Its entities.` }]),
);
