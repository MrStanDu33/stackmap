import { expect, fn, userEvent, within } from 'storybook/test';
import { ref } from 'vue';

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
// getByText collapses the page's whitespace, French non-breaking spaces included: expected text is collapsed alike.
const spaced = (text: string) => text.replace(/\s+/g, ' ');

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
    // A text field with a numeric keyboard: a number field would drop letters silently.
    const port = canvas.getByRole('textbox', { name: new RegExp(t('trace.form.port').replace(/[()]/g, '.')) });
    const submit = canvas.getByRole('button', { name: t('trace.form.submit') });

    await userEvent.click(submit);
    await expect(hostname).toHaveFocus();
    await expect(hostname).toHaveAccessibleDescription(expect.stringContaining(t('trace.form.error.hostname')) as unknown);

    await userEvent.type(hostname, '*.homelab.example');
    await userEvent.click(submit);
    await expect(canvas.getByText(spaced(t('trace.form.error.wildcard')))).toBeVisible();

    await userEvent.clear(hostname);
    await userEvent.type(hostname, 'app.homelab.example');
    await userEvent.type(port, '70000');
    await userEvent.click(submit);
    await expect(port).toHaveFocus();
    await expect(port).toHaveAccessibleDescription(expect.stringContaining(t('trace.form.error.port')) as unknown);
    await userEvent.clear(port);
    await userEvent.type(port, '4a3');
    await userEvent.click(submit);
    await expect(port).toHaveAccessibleDescription(expect.stringContaining(t('trace.form.error.port')) as unknown);
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** Enter in the field that already has focus: focus cannot move, so the error is announced. */
export const AnnouncesErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByRole('combobox', { name: t('trace.form.hostname') }), '*.homelab.example{Enter}');

    await expect(canvas.getByRole('status')).toHaveTextContent(spaced(t('trace.form.error.wildcard')));
  },
};

/** The URL's own errors are shown on load, with focus on the first invalid field. */
export const UrlErrors: Story = {
  args: { query: { hostname: '*.homelab.example', port: '0' }, errors: { hostname: 'trace.form.error.wildcard', port: 'trace.form.error.port' } },
  play: async ({ canvasElement }) => {
    const hostname = within(canvasElement).getByRole('combobox', { name: t('trace.form.hostname') });

    await expect(hostname).toHaveValue('*.homelab.example');
    await expect(hostname).toHaveFocus();
    await expect(hostname).toHaveAccessibleDescription(expect.stringContaining(spaced(t('trace.form.error.wildcard'))) as unknown);
  },
};

/** The page passes the same query again (the view changed): what the user typed and did not send stays. */
export const KeepsTyping: Story = {
  render: (args) => ({
    components: { TraceForm },
    setup: () => {
      const query = ref<Record<string, string>>({ hostname: 'app.homelab.example', client: 'public' });
      const again = () => {
        query.value = { ...query.value };
      };
      return { args, query, again };
    },
    template: '<div><TraceForm :query="query" :suggestions="args.suggestions" /><button type="button" @click="again">Same query again</button></div>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hostname = canvas.getByRole('combobox', { name: t('trace.form.hostname') });

    await userEvent.clear(hostname);
    await userEvent.type(hostname, 'npm.homelab.example');
    await userEvent.click(canvas.getByRole('button', { name: 'Same query again' }));

    await expect(hostname).toHaveValue('npm.homelab.example');
  },
};
