import { expect, userEvent, within } from 'storybook/test';

import DomainForm from './DomainForm.vue';
import { COMMON_DEFAULTS, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { DOMAINS } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/Core/DomainForm',
  component: DomainForm,
  args: formArgs('domain-form'),
  render: formRender(DomainForm),
} satisfies Meta<typeof DomainForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const name = (canvasElement: HTMLElement) => fieldOf(canvasElement, 'textbox', 'domain', 'name');

/** A new domain: its name, required; Save submits it with the common fields (42). */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(name(canvasElement), 'lab.example');
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: 'lab.example', ...COMMON_DEFAULTS });
  },
};

/** Editing: the domain's values (22). */
export const Editing: Story = {
  args: { entity: DOMAINS[0] },
  play: async ({ canvasElement, args }) => {
    await expect(name(canvasElement)).toHaveValue('homelab.example');
    await userEvent.clear(name(canvasElement));
    await userEvent.type(name(canvasElement), 'lab.example');
    await expect(args.onDirty).toHaveBeenLastCalledWith(true);
  },
};

/** An issue under its field (25). */
export const WithIssues: Story = {
  args: { issues: { name: ['Expected a domain name'] } },
  play: async ({ canvasElement }) => {
    await expect(name(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(name(canvasElement)).toHaveAttribute('id', 'domain-form-name');
  },
};

/** Read-only for viewers (18). */
export const ReadOnly: Story = {
  args: { entity: DOMAINS[0], readonly: true },
  play: async ({ canvasElement }) => {
    await expect(name(canvasElement)).toHaveAttribute('readonly');
    await expect(within(canvasElement).queryByRole('button', { name: t('inventory.save') })).toBeNull();
    // Values as read-only text, reachable and at full contrast: no disabled controls (review).
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
  },
};
