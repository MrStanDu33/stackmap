import { z } from 'zod';

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

export function unimplementedSchema<Fields, Input>(): EntitySchema<Fields, Input> {
  return { input: z.never(), patch: z.never() };
}
