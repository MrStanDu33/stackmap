import { z } from 'zod';

import { httpUrl, kebabId, text } from '../contracts/formats';

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

/** Fields the repository sets; never accepted as input. */
export interface EntityMeta {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Validates an entity's input (create: defaults applied) and patch (update: only the given fields). */
export interface EntitySchema<Fields, Input> {
  input: z.ZodType<Fields, Input>;
  patch: z.ZodType<Partial<Fields>, Partial<Input>>;
}

/** One line of text: no control characters at all, nor the invisible and bidi characters free text refuses. */
// eslint-disable-next-line no-control-regex -- the point is to refuse control characters.
const LINE = /^[^\u0000-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ORIGIN = /^(?:manual|connector:[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;

const MAX_TAGS = 50;
const MAX_LINKS = 20;
const MAX_CUSTOM_FIELDS = 50;

export const line = (maxLength: number) => z.string().max(maxLength).regex(LINE);
export const entityName = () => z.string().trim().min(1).max(100).regex(LINE);
export const entityId = () => z.string().max(36).regex(UUID);
/** A kind id, checked against the active extensions by the repository. */
export const kindId = kebabId;
export const port = () => z.number().int().min(1).max(65_535);

const unique = (values: string[]) => [...new Set(values)];

const COMMON_FIELDS = {
  status: z.enum(ENTITY_STATUSES).default('active'),
  tags: z.array(line(50).min(1)).max(MAX_TAGS).transform(unique).default([]),
  notes: text(20_000).default(''),
  links: z.array(z.strictObject({ label: line(100).min(1), url: httpUrl() })).max(MAX_LINKS).default([]),
  customFields: z.record(line(50).min(1), z.union([text(1000), z.number(), z.boolean(), z.null()]))
    .refine((fields) => Object.keys(fields).length <= MAX_CUSTOM_FIELDS, `At most ${String(MAX_CUSTOM_FIELDS)} custom fields`)
    .default({}),
  origin: z.string().max(80).regex(ORIGIN).default('manual'),
  externalRef: line(500).nullable().default(null),
};

const withoutDefault = (field: z.ZodType): z.ZodType =>
  (field instanceof z.ZodDefault ? field.unwrap() as z.ZodType : field);

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
  const input = refine ? object.transform((value, context) => refine(value as Fields, context)) : object;
  const patch = z.strictObject(Object.fromEntries(
    Object.entries(object.shape).map(([key, field]) => [key, withoutDefault(field as z.ZodType).optional()]),
  ));
  return { input, patch } as unknown as EntitySchema<Fields, Input>;
}
