import { computed, ref, watch } from 'vue';

import { issueMessage } from '../utils/issue-message';

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
const unsent = new Set<string>(UNSENT_FIELDS);

// Entity values are JSON; a JSON copy also unwraps Vue's reactive proxies, which structuredClone refuses.
const copy = <V>(value: V): V => (value === undefined ? value : JSON.parse(JSON.stringify(value)) as V);

export function formValues<T extends Values>(empty: T, entity?: Values): T {
  return Object.fromEntries(Object.entries(empty)
    .filter(([field]) => !unsent.has(field))
    .map(([field, value]) => [field, entity && field in entity ? copy(entity[field]) : value])) as T;
}

/** Equal by value; objects whatever the order of their keys. */
const same = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => same(item, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => same((a as Values)[key], (b as Values)[key]));
  }
  return a === b;
};

/** The fields an edit changed, compared by value; `null` when nothing changed. */
export function entityPatch(original: Values, values: Values): Values | null {
  const changed = Object.entries(values)
    .filter(([field, value]) => !unsent.has(field) && !same(original[field], value));
  return changed.length > 0 ? Object.fromEntries(changed) : null;
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
export function problemIssues(problem: Problem, { fields, t, te }: IssueOptions): FormIssues {
  const result: FormIssues = { fields: {}, summary: [] };
  const add = (path: string | null, message: string) => {
    if (path !== null && fields.includes(path.split('.')[0] ?? '')) {
      (result.fields[path] ??= []).push(message);
    } else {
      // No field to go to: the summary says it as text, not as a link to nothing.
      result.summary.push({ path: null, message });
    }
  };
  if (problem.code === 'entity_conflict') {
    for (const field of problem.fields ?? []) {
      add(field, t('inventory.conflict'));
    }
  } else if (problem.code === 'reference_invalid') {
    add(problem.field ?? null, t('inventory.referenceGone'));
  } else {
    for (const issue of problem.issues ?? []) {
      // `body.addresses.1.address` → `addresses.1.address`; `body` alone names no field.
      const path = issue.path.replace(/^body\.?/, '');
      add(path === '' ? null : path, issueMessage(issue, { t, te }));
    }
  }
  return result;
}

export interface EntityForm<T extends Values> {
  values: Ref<T>;
  /** Whether the values differ from those the form started from. */
  dirty: Readonly<Ref<boolean>>;
  saving: Ref<boolean>;
  /** Saves the values once at a time; a submit while saving is ignored. */
  submit: () => Promise<void>;
  /** Starts again from these values: after a reload. */
  reset: (entity?: Values) => void;
}

/** A form's state: its values, whether they changed, and its save. */
export function useEntityForm<T extends Values>({ empty, entity, save }: {
  empty: T;
  entity?: Values;
  save: (values: T) => Promise<void>;
}): EntityForm<T> {
  const start = ref(formValues(empty, entity)) as Ref<T>;
  const values = ref(formValues(empty, entity)) as Ref<T>;
  const saving = ref(false);
  const dirty = computed(() => entityPatch(start.value, values.value) !== null);
  const submit = async () => {
    if (saving.value) {
      return;
    }
    saving.value = true;
    try {
      const sent = copy(values.value);
      await save(sent);
      start.value = sent;
    } finally {
      saving.value = false;
    }
  };
  const reset = (next?: Values) => {
    start.value = formValues(empty, next);
    values.value = formValues(empty, next);
  };
  return { values, dirty, saving, submit, reset };
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
export const fieldId = (formId: string, path: string): string => `${formId}-${path.replaceAll('.', '-')}`;

/** The common fields' values for a new entity. */
export const COMMON_EMPTY = { status: 'active', tags: [] as string[], notes: '', links: [] as { label: string; url: string }[] };

/** Empty text as null, for nullable fields. */
export const orNull = (value: unknown): unknown => (typeof value === 'string' && value.trim() === '' ? null : value);

/** A number field's value: null when empty. */
export const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number(value);
};

/**
 * What every inventory form shares: its values (the entity's, or the empty ones), the common fields' part of them,
 * field ids and issues, and its events. The form reloads its values when the entity changes (Reload).
 */
export function useInventoryForm<T extends Values & typeof COMMON_EMPTY>(
  props: EntityFormProps,
  empty: T,
  events: { submit: (values: T) => void; dirty: (dirty: boolean) => void },
) {
  const form = useEntityForm({ empty, entity: props.entity, save: () => Promise.resolve() });
  watch(form.dirty, (dirty) => {
    events.dirty(dirty);
  });
  watch(() => props.entity, (entity) => {
    form.reset(entity);
  });
  const common = computed({
    get: () => {
      const { status, tags, notes, links } = form.values.value;
      return { status, tags, notes, links };
    },
    set: (value: typeof COMMON_EMPTY) => {
      form.values.value = { ...form.values.value, ...value };
    },
  });
  return {
    values: form.values,
    common,
    id: (path: string) => fieldId(props.formId, path),
    issue: (path: string) => props.issues[path] ?? [],
    submit: () => {
      events.submit(form.values.value);
    },
  };
}
