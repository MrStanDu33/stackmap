import { expect, fn, userEvent, within } from 'storybook/test';

import TraceForm from './TraceForm.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/TraceForm',
  component: TraceForm,
  args: { query: null, suggestions: ['app.homelab.example', 'homelab.example', 'npm.homelab.example'], onSubmit: fn() },
} satisfies Meta<typeof TraceForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

/** A search landmark: a valid name is submitted lower-cased, from the Internet, without a port; names are suggested. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const form = canvas.getByRole('search', { name: t('trace.form.label') });
    const hostname = within(form).getByRole('combobox', { name: t('trace.form.hostname') });

    await expect(canvasElement.querySelector('datalist option[value="app.homelab.example"]')).not.toBeNull();
    await expect(within(form).getByRole('radio', { name: t('traffic.client.public') })).toBeChecked();
    await userEvent.type(hostname, 'APP.Homelab.Example');
    await userEvent.click(within(form).getByRole('button', { name: t('trace.form.submit') }));

    await expect(args.onSubmit).toHaveBeenCalledWith({ hostname: 'app.homelab.example', client: 'public', port: null });
  },
};

/** Each error is written next to its field and linked to it; focus moves to the first invalid field; none is sent. */
export const Invalid: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const hostname = canvas.getByRole('combobox', { name: t('trace.form.hostname') });
    const port = canvas.getByRole('spinbutton', { name: new RegExp(t('trace.form.port').replace(/[()]/g, '.')) });
    const submit = canvas.getByRole('button', { name: t('trace.form.submit') });

    await userEvent.click(submit);
    await expect(hostname).toHaveFocus();
    await expect(hostname).toHaveAccessibleDescription(expect.stringContaining(t('trace.form.error.hostname')) as unknown);

    await userEvent.type(hostname, '*.homelab.example');
    await userEvent.click(submit);
    await expect(canvas.getByText(t('trace.form.error.wildcard'))).toBeVisible();

    await userEvent.clear(hostname);
    await userEvent.type(hostname, 'app.homelab.example');
    await userEvent.type(port, '70000');
    await userEvent.click(submit);
    await expect(port).toHaveFocus();
    await expect(port).toHaveAccessibleDescription(expect.stringContaining(t('trace.form.error.port')) as unknown);
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
