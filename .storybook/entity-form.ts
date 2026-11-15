/*
 * The harness of the inventory forms' stories: a form with the props the inventory page gives it, and the Save button
 * the slide-over puts below it (which submits the form by its id).
 */
import { fn, userEvent, within } from 'storybook/test';

import { REFERENCES } from './inventory';
import { i18n } from './nuxt-shims';

import type { Component } from 'vue';

const { t } = i18n.global;

/** The common fields' defaults, which every form submits with its own. */
export const COMMON_DEFAULTS = { status: 'active', tags: [], notes: '', links: [] };

export const formArgs = (formId: string) => ({
  formId,
  entity: undefined as Record<string, unknown> | undefined,
  issues: {} as Record<string, string[]>,
  readonly: false,
  references: REFERENCES,
  onSubmit: fn(),
  onDirty: fn(),
});

export const formRender = (form: Component) => <Args>(args: Args) => ({
  components: { EntityFormUnderTest: form },
  setup: () => ({ args, save: t('inventory.save') }),
  template: `<div>
    <EntityFormUnderTest v-bind="args" />
    <button v-if="!args.readonly" type="submit" :form="args.formId">{{ save }}</button>
  </div>`,
});

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A field's accessible name starts with its translated label (then "required", when it is). */
export const fieldName = (entity: string, field: string) => new RegExp(`^${escape(t(`extensions.core.fields.${entity}.${field}`))}`);

export const fieldOf = (canvasElement: HTMLElement, role: 'textbox' | 'combobox' | 'spinbutton' | 'checkbox', entity: string, field: string) =>
  within(canvasElement).getByRole(role, { name: fieldName(entity, field) });

export const save = (canvasElement: HTMLElement) => userEvent.click(within(canvasElement).getByRole('button', { name: t('inventory.save') }));
