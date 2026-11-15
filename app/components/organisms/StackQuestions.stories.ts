import { expect, fn, userEvent, within } from 'storybook/test';
import { ref } from 'vue';

import StackQuestions from './StackQuestions.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { INSTALLED_EXTENSIONS } from '../../../tests/support/extensions';

import type { WorkspaceExtension } from '../../../shared/contracts/extensions';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

/** The built-in extensions of a new workspace, all on until onboarding says otherwise. */
const EXTENSIONS: WorkspaceExtension[] = [...INSTALLED_EXTENSIONS];
const extension = (id: string) => EXTENSIONS.find((installed) => installed.id === id) as WorkspaceExtension;

const meta = {
  title: 'Organisms/StackQuestions',
  component: StackQuestions,
  args: {
    extensions: EXTENSIONS,
    busy: false,
    error: null,
    extensionsPath: '/w/home/extensions',
    onSubmit: fn(),
    onSkip: fn(),
  },
} satisfies Meta<typeof StackQuestions>;

export default meta;
type Story = StoryObj<typeof meta>;

const question = (id: string) => t(extension(id).onboarding ?? '');
const hint = (id: string) => t('onboarding.hint', { name: t(extension(id).name), description: t(extension(id).description) });
const box = (canvasElement: HTMLElement, name: string) => within(canvasElement).getByRole('checkbox', { name });
const press = (canvasElement: HTMLElement, name: string) =>
  userEvent.click(within(canvasElement).getByRole('button', { name }));

/** A plain question per optional extension, unchecked, described by the extension's name and description (17). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: t('onboarding.title') })).toBeVisible();
    await expect(canvas.getAllByRole('checkbox')).toHaveLength(2);
    for (const id of ['nat', 'reverse-proxy']) {
      await expect(box(canvasElement, question(id))).not.toBeChecked();
      await expect(box(canvasElement, question(id))).toHaveAccessibleDescription(hint(id));
    }
  },
};

/** An extension that asks no question is offered by its name (18). */
export const NoQuestion: Story = {
  args: {
    extensions: EXTENSIONS.map(({ onboarding: _onboarding, ...installed }) => installed),
  },
  play: async ({ canvasElement }) => {
    await expect(box(canvasElement, t(extension('nat').name))).not.toBeChecked();
    await expect(box(canvasElement, t(extension('reverse-proxy').name))).not.toBeChecked();
  },
};

/** Continue sends the extensions checked (19). */
export const Continue: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(box(canvasElement, question('nat')));
    await press(canvasElement, t('onboarding.continue'));

    await expect(args.onSubmit).toHaveBeenCalledWith(['nat']);
  },
};

/** With nothing checked, Continue sends an empty choice: every optional extension goes off (20). */
export const ContinueWithNothing: Story = {
  play: async ({ canvasElement, args }) => {
    await press(canvasElement, t('onboarding.continue'));

    await expect(args.onSubmit).toHaveBeenCalledWith([]);
  },
};

/** Skip for now sends nothing (21). */
export const Skip: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(box(canvasElement, question('nat')));
    await press(canvasElement, t('onboarding.skip'));

    await expect(args.onSkip).toHaveBeenCalled();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** A workspace that already has data: an alert links to its Extensions page, and the form stays (22). */
export const NotEmpty: Story = {
  args: { error: 'not-empty' },
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert');
    await expect(within(alert).getByRole('link', { name: t('onboarding.extensionsPage') }))
      .toHaveAttribute('href', '/w/home/extensions');
    await expect(within(canvasElement).getAllByRole('checkbox')).toHaveLength(2);
  },
};

/** A save that failed says so in an alert, and keeps the choices so that Continue tries again (23). */
export const Failed: Story = {
  render: (args) => ({
    components: { StackQuestions },
    setup: () => {
      // As the page does: the save fails.
      const error = ref<'failed' | null>(null);
      const submit = (ids: string[]) => {
        (args.onSubmit as (chosen: string[]) => void)(ids);
        error.value = 'failed';
      };
      return { args, error, submit };
    },
    template: '<StackQuestions v-bind="args" :error="error" @submit="submit" />',
  }),
  play: async ({ canvasElement, args }) => {
    await userEvent.click(box(canvasElement, question('nat')));
    await press(canvasElement, t('onboarding.continue'));

    await expect(await within(canvasElement).findByRole('alert')).toHaveTextContent(t('onboarding.failed'));
    await expect(box(canvasElement, question('nat'))).toBeChecked();
    await press(canvasElement, t('onboarding.continue'));
    await expect(args.onSubmit).toHaveBeenCalledTimes(2);
    await expect(args.onSubmit).toHaveBeenLastCalledWith(['nat']);
  },
};

/** While the choice is saved, Continue says so and a second press sends nothing; Skip stays usable (25). */
export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('onboarding.continue') }));
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: t('onboarding.skip') })).toBeEnabled();
  },
};

/** While the extensions load, it says so in words. */
export const Loading: Story = {
  args: { extensions: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(t('onboarding.loading'))).toBeInTheDocument();
    await expect(within(canvasElement).queryAllByRole('checkbox')).toEqual([]);
  },
};
