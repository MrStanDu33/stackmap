import { z } from 'zod';

import { httpUrl, kebabId, line, LINE, text } from '../formats';

export const ENTITY_STATUSES = ['planned', 'active', 'deprecated'] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export interface EntityLink {
  label: string;
  url: string;
}

export type CustomFieldValue = string | number | boolean | null;

/** Fields every entity has. */
export interface CommonFields {
  status: EntityStatus;
  tags: string[];
  /** Markdown. */
  notes: string;
  links: EntityLink[];
  customFields: Record<string, CustomFieldValue>;
  /** `manual`, or `connector:<id>` for an entity a connector imported. */
  origin: string;
  /** The entity's id in the system it was imported from. */
  externalRef: string | null;
}

export type CommonInput = Partial<CommonFields>;

export interface EntityIssue {
  /** Dotted path of the field: `name`, `addresses.1.address`. */
  path: string;
  /** In English: the fallback when the interface has no translation of `code`. */
  message: string;
  /** Stable, prefixed with the extension id, for the interface to translate: `core.address-outside-network`. */
  code?: string;
  /** The values the translation needs. */
  params?: Record<string, string | number>;
}

/** Fields the repository sets; never accepted as input. */
export interface EntityMeta {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The fields of `EntityMeta`, which a repository definition may not store, filter or own. */
export const ENTITY_META_FIELDS = [
  'id', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt',
] as const satisfies readonly (keyof EntityMeta)[];

/** Validates an entity's input (create: defaults applied) and patch (update: only the given fields). */
export interface EntitySchema<Fields, Input> {
  input: z.ZodType<Fields, Input>;
  patch: z.ZodType<Partial<Fields>, Partial<Input>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ORIGIN = /^(?:manual|connector:[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;

const MAX_TAGS = 50;
const MAX_LINKS = 20;
const MAX_CUSTOM_FIELDS = 50;

export { line };
// Trimmed first, so surrounding spaces count neither for the minimum nor the maximum.
export const entityName = () => z.string().trim().min(1).max(100).regex(LINE);
export const entityId = () => z.string().max(36).regex(UUID);
/** A kind id, checked against the active extensions by the repository. */
export const kindId = kebabId;
export const port = () => z.number().int().min(1).max(65_535);

const unique = (values: string[]) => [...new Set(values)];

const COMMON_FIELDS = {
  status: z.enum(ENTITY_STATUSES).default('active')
    .meta({ description: 'Whether the entity is planned, in use or on its way out', examples: ['active'] }),
  tags: z.array(line(50).min(1)).max(MAX_TAGS).overwrite(unique).default([])
    .meta({ description: 'Free labels, each once', examples: [['storage']] }),
  notes: text(20_000).default('').meta({ description: 'Notes, in Markdown', examples: ['Under the desk'] }),
  links: z.array(z.strictObject({
    label: line(100).min(1).meta({ description: 'What the link points to', examples: ['Admin page'] }),
    url: httpUrl().meta({ description: 'An http or https URL', examples: ['https://nas.homelab.example'] }),
  })).max(MAX_LINKS).default([])
    .meta({ description: 'Links to elsewhere', examples: [[{ label: 'Admin page', url: 'https://nas.homelab.example' }]] }),
  customFields: z.record(line(50).min(1), z.union([text(1000), z.number(), z.boolean(), z.null()]))
    .refine((fields) => Object.keys(fields).length <= MAX_CUSTOM_FIELDS, {
      message: `At most ${String(MAX_CUSTOM_FIELDS)} custom fields`,
      params: { code: 'common.too-many-custom-fields', maximum: MAX_CUSTOM_FIELDS },
    })
    .default({})
    .meta({ description: 'Values of the workspace\'s own fields, by name', examples: [{ rack: 'A2' }] }),
  origin: z.string().max(80).regex(ORIGIN).default('manual')
    .meta({ description: '`manual`, or `connector:<id>` for an entity a connector imported', examples: ['manual'] }),
  externalRef: line(500).nullable().default(null)
    .meta({ description: 'The entity\'s id in the system it was imported from', examples: ['vm-104'] }),
};

/** Optional and without its default, keeping its description: a patch documents the same fields. */
const patchField = (field: z.ZodType): z.ZodType => {
  const optional = (field instanceof z.ZodDefault ? field.unwrap() as z.ZodType : field).optional();
  const meta = field.meta();
  return meta ? optional.meta(meta) : optional;
};

/**
 * Runs the refine on an input some fields of which failed, so that one answer lists every issue, unless the refine
 * reads one of the failed fields: its checks hold for valid values only. Its result is dropped: the parse fails.
 */
function refineDespiteIssues<Fields>(
  refine: (value: Fields, context: z.RefinementCtx) => Fields,
): z.core.$ZodCheck<unknown> {
  const check = z.check((payload) => {
    const failed = new Set(payload.issues.map(({ path }) => path?.[0]));
    const value = payload.value as Record<PropertyKey, unknown>;
    const guarded = new Proxy(value, {
      get: (target, key) => {
        if (failed.has(key)) {
          throw new Error(`The refine reads ${String(key)}, which failed.`);
        }
        return Reflect.get(target, key);
      },
    });
    const context = {
      value,
      issues: payload.issues,
      addIssue: (issue: string | z.core.$ZodRawIssue) => {
        payload.issues.push(typeof issue === 'string'
          ? { code: 'custom', message: issue, input: value, path: [] }
          : { path: [], ...issue, input: value } as z.core.$ZodRawIssue);
      },
    } as unknown as z.RefinementCtx;
    try {
      refine(guarded as Fields, context);
    } catch {
      // It read a failed field, or a value an unknown key left unparsed: the issues already found are the answer.
    }
  });
  // Only on an input with issues: on a valid one, the transform runs the refine.
  check._zod.def.when = ({ issues }) => issues.length > 0;
  return check;
}

/**
 * The schemas of an entity: its own fields (listed first, so issues come in the form's order) and the common ones.
 * `refine` checks or normalizes across fields, on the whole input; the repository runs it on the patched entity too.
 * Neither schema accepts unknown fields, so `id`, `workspaceId` and the audit fields are refused.
 */
export function defineEntitySchema<Fields, Input>(
  shape: z.ZodRawShape,
  refine?: (value: Fields, context: z.RefinementCtx) => Fields,
): EntitySchema<Fields, Input> {
  const object = z.strictObject({ ...shape, ...COMMON_FIELDS });
  const input = refine
    ? object.check(refineDespiteIssues(refine))
        .transform((value, context) => refine(value as Fields, context))
    : object;
  const patch = z.strictObject(Object.fromEntries(
    Object.entries(object.shape).map(([key, field]) => [key, patchField(field as z.ZodType)]),
  ));
  return { input, patch } as unknown as EntitySchema<Fields, Input>;
}
