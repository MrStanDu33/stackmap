import { expect, userEvent, waitFor, within } from 'storybook/test';

import DisplayPreferences from './DisplayPreferences.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/DisplayPreferences',
  component: DisplayPreferences,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DisplayPreferences>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

const html = document.documentElement;

/** Every control has a visible label and shows its current value. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { name: t('preferences.title') })).toBeVisible();
    await expect(canvas.getByRole('radiogroup', { name: t('preferences.theme') })).toBeVisible();
    await expect(canvas.getByRole('radio', { name: t('preferences.midnight') })).toBeChecked();
    await expect(canvas.getByRole('radiogroup', { name: t('preferences.contrast') })).toBeVisible();
    await expect(canvas.getByRole('radio', { name: t('preferences.standard') })).toBeChecked();
    await expect(canvas.getByRole('combobox', { name: t('preferences.language') })).toHaveTextContent(i18n.global.locale.value === 'fr' ? 'Français' : 'English');
  },
};

export const Light: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('radio', { name: t('preferences.light') }));

    await expect(html).toHaveClass('light');
    await expect(html).not.toHaveClass('dark');
    // Back to the default, so the next stories start from it.
    await userEvent.click(within(canvasElement).getByRole('radio', { name: t('preferences.midnight') }));
    await expect(html).toHaveClass('dark');
  },
};

export const Strict: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('radio', { name: t('preferences.strict') }));

    await expect(html).toHaveAttribute('data-contrast', 'strict');
    await userEvent.click(within(canvasElement).getByRole('radio', { name: t('preferences.standard') }));
    await expect(html).not.toHaveAttribute('data-contrast');
  },
};

export const French: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('combobox', { name: t('preferences.language') }));
    await userEvent.click(within(document.body).getByRole('option', { name: 'Français' }));

    await waitFor(() => expect(i18n.global.locale.value).toBe('fr'));
    await expect(canvas.getByRole('heading', { name: 'Affichage' })).toBeVisible();
  },
};
