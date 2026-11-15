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
const group = (canvasElement: HTMLElement, name: string) => within(canvasElement).getByRole('group', { name });

const PORT_FORWARDS = t('extensions.nat.entitiesPlural.port-forward');
const PROXY_ROUTES = t('extensions.reverse-proxy.entitiesPlural.route');
const PROXY_KIND = t('extensions.reverse-proxy.kinds.service.reverse-proxy');

/**
 * Fictional extensions, ACME certificates needing TLS certificates, to show requirements: no built-in extension
 * needs another optional one.
 */
const tls: WorkspaceExtension = {
  ...extension('nat'),
  id: 'tls',
  name: 'TLS certificates',
  description: 'Certificates and where they are used.',
  onboarding: 'Do you manage TLS certificates?',
  entities: [{ id: 'certificate', label: 'Certificate' }],
};
const acme: WorkspaceExtension = {
  ...extension('nat'),
  id: 'acme',
  name: 'ACME certificates',
  description: 'Certificates renewed through ACME.',
  onboarding: 'Do you renew certificates with ACME?',
  dependsOn: ['core', 'tls'],
  entities: [{ id: 'account', label: 'ACME account' }],
};
// Strings of the fictional extensions are plain text: the i18n shim gives back what it cannot translate.
const REQUIRING = [extension('core'), tls, acme];
const itemOf = (id: string, entity: string) => t(`extensions.${id}.entitiesPlural.${entity}`);

/**
 * A group per optional extension, named by its question and described by its name and description, with an
 * unchecked checkbox per entity type and kind it adds (17′).
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: t('onboarding.title') })).toBeVisible();
    for (const id of ['nat', 'reverse-proxy']) {
      await expect(group(canvasElement, question(id))).toHaveAccessibleDescription(hint(id));
    }
    await expect(within(group(canvasElement, question('nat'))).getAllByRole('checkbox')).toHaveLength(1);
    await expect(within(group(canvasElement, question('reverse-proxy'))).getAllByRole('checkbox')).toHaveLength(2);
    for (const name of [PORT_FORWARDS, PROXY_ROUTES, PROXY_KIND]) {
      await expect(box(canvasElement, name)).not.toBeChecked();
    }
    await expect(box(canvasElement, PROXY_KIND))
      .toHaveAccessibleDescription(t('onboarding.kindHint', { entity: t('extensions.core.entities.service') }));
  },
};

/** An extension that asks no question has its group named by its name (17′). */
export const NoQuestion: Story = {
  args: {
    extensions: EXTENSIONS.map(({ onboarding: _onboarding, ...installed }) => installed),
  },
  play: async ({ canvasElement }) => {
    await expect(group(canvasElement, t(extension('nat').name))).toBeVisible();
    await expect(group(canvasElement, t(extension('reverse-proxy').name))).toBeVisible();
  },
};

/** An extension that adds no entity type and no kind is one checkbox, named after it (18′). */
export const NoItems: Story = {
  args: {
    extensions: EXTENSIONS.map((installed) => (installed.id === 'nat' ? { ...installed, entities: [] } : installed)),
  },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(group(canvasElement, question('nat'))).getByRole('checkbox', { name: t(extension('nat').name) }));
    await press(canvasElement, t('onboarding.continue'));

    await expect(args.onSubmit).toHaveBeenCalledWith(['nat']);
  },
};

/** Continue sends the extensions with an item checked (19′). */
export const Continue: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(box(canvasElement, PORT_FORWARDS));
    await press(canvasElement, t('onboarding.continue'));

    await expect(args.onSubmit).toHaveBeenCalledWith(['nat']);
  },
};

/** Any item of an extension turns it on, once, in the order shown: its kind alone, or with its entity type (19′). */
export const ItemPicksExtension: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(box(canvasElement, PROXY_KIND));
    await press(canvasElement, t('onboarding.continue'));
    await expect(args.onSubmit).toHaveBeenLastCalledWith(['reverse-proxy']);

    await userEvent.click(box(canvasElement, PROXY_ROUTES));
    await userEvent.click(box(canvasElement, PORT_FORWARDS));
    await press(canvasElement, t('onboarding.continue'));
    await expect(args.onSubmit).toHaveBeenLastCalledWith(['reverse-proxy', 'nat']);
  },
};

/** With nothing checked, Continue sends an empty choice: every optional extension goes off (20′). */
export const ContinueWithNothing: Story = {
  play: async ({ canvasElement, args }) => {
    await press(canvasElement, t('onboarding.continue'));

    await expect(args.onSubmit).toHaveBeenCalledWith([]);
  },
};

/** Checking an item checks the items of the extensions it needs, and says so (28). */
export const Requirements: Story = {
  args: { extensions: REQUIRING },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(box(canvasElement, itemOf('acme', 'account')));

    await expect(box(canvasElement, itemOf('tls', 'certificate'))).toBeChecked();
    await expect(within(canvasElement).getByRole('status'))
      .toHaveTextContent(t('onboarding.alsoChecked', { item: itemOf('acme', 'account'), names: itemOf('tls', 'certificate') }));
    await press(canvasElement, t('onboarding.continue'));
    await expect(args.onSubmit).toHaveBeenCalledWith(['tls', 'acme']);
  },
};

/** An item checked as a requirement can be unchecked; the choice still holds the extension that needs it (29). */
export const RequirementsFree: Story = {
  args: { extensions: REQUIRING },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(box(canvasElement, itemOf('acme', 'account')));
    await userEvent.click(box(canvasElement, itemOf('tls', 'certificate')));

    await expect(box(canvasElement, itemOf('tls', 'certificate'))).not.toBeChecked();
    await press(canvasElement, t('onboarding.continue'));
    await expect(args.onSubmit).toHaveBeenCalledWith(['acme']);
  },
};

/** A requirement already met changes nothing else, and nothing is said (30). */
export const RequirementAlreadyMet: Story = {
  args: {
    extensions: [extension('core'), { ...tls, entities: [...tls.entities, { id: 'store', label: 'Store' }] }, acme],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(box(canvasElement, itemOf('tls', 'store')));
    await userEvent.click(box(canvasElement, itemOf('acme', 'account')));

    await expect(box(canvasElement, itemOf('tls', 'certificate'))).not.toBeChecked();
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('');
  },
};

/** Skip for now sends nothing (21). */
export const Skip: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(box(canvasElement, PORT_FORWARDS));
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
    await expect(within(canvasElement).getAllByRole('checkbox')).toHaveLength(3);
  },
};

/** A save that failed says so in an alert, and keeps the choices so that Continue tries again (23). */
export const Failed: Story = {
  render: (args) => ({
    components: { StackQuestions },
    setup: () => {
      // As the page does: the save fails.
      const error = ref<'failed' | null>(null);
      // args.onSubmit hears the submit too, through v-bind.
      const submit = () => {
        error.value = 'failed';
      };
      return { args, error, submit };
    },
    template: '<StackQuestions v-bind="args" :error="error" @submit="submit" />',
  }),
  play: async ({ canvasElement, args }) => {
    await userEvent.click(box(canvasElement, PORT_FORWARDS));
    await press(canvasElement, t('onboarding.continue'));

    await expect(await within(canvasElement).findByRole('alert')).toHaveTextContent(t('onboarding.failed'));
    await expect(box(canvasElement, PORT_FORWARDS)).toBeChecked();
    await press(canvasElement, t('onboarding.continue'));
    await expect(args.onSubmit).toHaveBeenCalledTimes(2);
    await expect(args.onSubmit).toHaveBeenLastCalledWith(['nat']);
  },
};

/**
 * While the choice is saved, Continue says so and a second press sends nothing; it keeps the focus, so that an error
 * is read from there (review: a disabled button would drop it). Skip stays usable (25).
 */
export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const proceed = canvas.getByRole('button', { name: t('onboarding.continue') });
    await expect(proceed).toHaveAttribute('aria-busy', 'true');
    await expect(proceed).toBeEnabled();
    await userEvent.click(proceed);
    await expect(proceed).toHaveFocus();
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
