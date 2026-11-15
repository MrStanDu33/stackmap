import { ref } from 'vue';

import type { Problem } from '../../shared/contracts/errors';
import type { Issue } from '../utils/issue-message';
import type { Translate } from '../utils/traffic-graph';
import type { Ref } from 'vue';

type Values = Record<string, unknown>;

/** Fields a form never sends: the repository's, and those the inventory does not edit yet. */
export const UNSENT_FIELDS = [
  'id', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'customFields', 'origin', 'externalRef',
] as const;

/** A form's starting values: the empty ones, or the entity's for the same fields. */
export function formValues<T extends Values>(_empty: T, _entity?: Values): T {
  throw new Error('Not implemented');
}

/** The fields an edit changed, compared by value; `null` when nothing changed. */
export function entityPatch(_original: Values, _values: Values): Values | null {
  throw new Error('Not implemented');
}

export interface FormIssues {
  /** Translated messages by field path: `name`, `addresses.1.address`. */
  fields: Record<string, string[]>;
  /** Issues no field of the form shows, for the summary. */
  summary: { path: string | null; message: string }[];
}

export interface IssueOptions {
  /** The form's top-level fields: an issue on another shows in the summary. */
  fields: readonly string[];
  t: Translate;
  te: (key: string) => boolean;
}

/** A refused save's Problem as issues by field: validation, conflicts and gone references. */
export function problemIssues(_problem: Problem, _options: IssueOptions): FormIssues {
  throw new Error('Not implemented');
}

export interface EntityForm<T extends Values> {
  values: Ref<T>;
  /** Whether the values differ from those the form started from. */
  dirty: Ref<boolean>;
  saving: Ref<boolean>;
  /** Saves the values once at a time; a submit while saving is ignored. */
  submit: () => Promise<void>;
  /** Starts again from these values: after a reload. */
  reset: (entity?: Values) => void;
}

/** A form's state: its values, whether they changed, and its save. */
export function useEntityForm<T extends Values>(_options: {
  empty: T;
  entity?: Values;
  save: (values: T) => Promise<void>;
}): EntityForm<T> {
  return {
    values: ref({}) as Ref<T>,
    dirty: ref(false),
    saving: ref(false),
    submit: () => Promise.resolve(),
    reset: () => undefined,
  };
}

export type { Issue };

/** What the inventory gives every type's form. */
export interface EntityFormProps {
  /** The `<form>`'s id: the slide-over's Save submits it; fields are `<formId>-<path>`. */
  formId: string;
  /** The entity to edit; absent for a new one. */
  entity?: Values;
  /** Translated messages by field path. */
  issues: Record<string, string[]>;
  readonly: boolean;
  /** The entities each reference field can choose from, by type: `core/site`. */
  references: Record<string, { id: string; label: string }[]>;
}

/** A field's id in a form: `host-form-addresses-1-address`. */
export function fieldId(_formId: string, _path: string): string {
  throw new Error('Not implemented');
}
