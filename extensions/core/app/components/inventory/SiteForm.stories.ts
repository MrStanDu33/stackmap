import { expect, userEvent, within } from 'storybook/test';

import SiteForm from './SiteForm.vue';
import { COMMON_DEFAULTS, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { SITES } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/Core/SiteForm',
  component: SiteForm,
  args: formArgs('site-form'),
  render: formRender(SiteForm),
} satisfies Meta<typeof SiteForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const name = (canvasElement: HTMLElement) => fieldOf(canvasElement, 'textbox', 'site', 'name');

/** A new site: its name, required, then the common fields; Save submits the whole input (37, 34). */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(name(canvasElement)).toHaveAccessibleName(expect.stringContaining(t('inventory.required')) as string);
    await expect(within(canvasElement).getByRole('combobox', { name: new RegExp(`^${t('inventory.common.status')}`) })).toBeVisible();
    await userEvent.type(name(canvasElement), 'Garage');
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: 'Garage', ...COMMON_DEFAULTS });
  },
};

/** Editing: the site's values; a change says the form is dirty (22, 33). */
export const Editing: Story = {
  args: { entity: SITES[0] },
  play: async ({ canvasElement, args }) => {
    await expect(name(canvasElement)).toHaveValue('Home');
    await userEvent.type(name(canvasElement), ' lab');
    await expect(args.onDirty).toHaveBeenLastCalledWith(true);
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Home lab' }));
  },
};

/** An issue under its field, which has the id the summary links to (25). */
export const WithIssues: Story = {
  args: { issues: { name: ['Too long'] } },
  play: async ({ canvasElement }) => {
    await expect(name(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(name(canvasElement)).toHaveAccessibleDescription(expect.stringContaining('Too long') as string);
    await expect(name(canvasElement)).toHaveAttribute('id', 'site-form-name');
  },
};

/** Read-only for viewers (18). */
export const ReadOnly: Story = {
  args: { entity: SITES[0], readonly: true },
  play: async ({ canvasElement }) => {
    await expect(name(canvasElement)).toHaveAttribute('readonly');
    // Values as read-only text, reachable and at full contrast: no disabled controls (review).
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
  },
};
