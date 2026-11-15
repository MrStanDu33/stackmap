import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import ExtensionToggleConfirm from './ExtensionToggleConfirm.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Molecules/ExtensionToggleConfirm',
  component: ExtensionToggleConfirm,
  args: {
    open: true,
    extension: 'nat',
    enabled: false,
    changes: [{ id: 'nat', enabled: false, entities: [{ entity: 'port-forward', count: 3 }], derivedFlows: 2 }],
    onConfirm: fn(),
    'onUpdate:open': fn(),
  },
} satisfies Meta<typeof ExtensionToggleConfirm>;

export default meta;
type Story = StoryObj<typeof meta>;

const dialog = () => within(document.body).getByRole('alertdialog');
// toHaveTextContent normalizes the page's whitespace, French non-breaking spaces included, not the expected text.
const text = (value: string) => value.replace(/\s+/g, ' ');
const nat = () => t('extensions.nat.name');

/** Turning off names what stays saved but hidden and that nothing is deleted; Cancel has the focus (27). */
export const TurnOffWithData: Story = {
  play: async ({ args }) => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await expect(within(dialog()).getByRole('heading', { name: t('workspaceExtensions.confirmOffTitle', { name: nat() }) })).toBeVisible();
    await expect(dialog()).toHaveTextContent(text(t('workspaceExtensions.hiddenData')));
    await expect(dialog()).toHaveTextContent(text(t('workspaceExtensions.entityCount', {
      type: t('extensions.nat.entitiesPlural.port-forward'), count: 3,
    })));
    await expect(dialog()).toHaveTextContent(text(t('workspaceExtensions.derivedFlows', { count: 2 }, 2)));
    await expect(dialog()).toHaveTextContent(text(t('workspaceExtensions.nothingDeleted')));
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: t('workspaceExtensions.cancel') })).toHaveFocus());
    await userEvent.click(within(dialog()).getByRole('button', { name: t('workspaceExtensions.turnOff') }));
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

/** The dialog is described by its message: what stays hidden and that nothing is deleted (review). */
export const Described: Story = {
  play: async () => {
    await waitFor(() => expect(dialog()).toBeVisible());
    // Accessible descriptions keep French non-breaking spaces: compared as translated.
    await expect(dialog()).toHaveAccessibleDescription(expect.stringContaining(t('workspaceExtensions.nothingDeleted')) as string);
    await expect(dialog()).toHaveAccessibleDescription(expect.stringContaining(t('workspaceExtensions.hiddenData')) as string);
  },
};

/** Counts are formatted in the page's language, flows included (review). */
export const LargeCounts: Story = {
  args: { changes: [{ id: 'nat', enabled: false, entities: [{ entity: 'port-forward', count: 1200 }], derivedFlows: 3400 }] },
  play: async () => {
    await waitFor(() => expect(dialog()).toBeVisible());
    const number = (value: number) => new Intl.NumberFormat(i18n.global.locale.value).format(value);
    await expect(dialog()).toHaveTextContent(text(t('workspaceExtensions.derivedFlows', { count: number(3400) }, 3400)));
    await expect(dialog()).toHaveTextContent(text(number(1200)));
  },
};

/** Cancel closes without turning anything off (27). */
export const Cancel: Story = {
  play: async ({ args }) => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await userEvent.click(within(dialog()).getByRole('button', { name: t('workspaceExtensions.cancel') }));
    await expect(args['onUpdate:open']).toHaveBeenLastCalledWith(false);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};

/** With nothing saved, it does not list hidden data, and still says nothing is deleted. */
export const TurnOffEmpty: Story = {
  args: {
    extension: 'reverse-proxy',
    changes: [{ id: 'reverse-proxy', enabled: false, entities: [{ entity: 'route', count: 0 }], derivedFlows: 0 }],
  },
  play: async () => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await expect(dialog()).not.toHaveTextContent(text(t('workspaceExtensions.hiddenData')));
    await expect(dialog()).toHaveTextContent(text(t('workspaceExtensions.nothingDeleted')));
  },
};

/** The extensions that need it go off with it, and are named (27). */
export const TurnOffDependents: Story = {
  args: {
    extension: 'reverse-proxy',
    changes: [
      { id: 'reverse-proxy', enabled: false, entities: [{ entity: 'route', count: 0 }], derivedFlows: 0 },
      // As if NAT needed the reverse proxy: the component only lists what the server says changes.
      { id: 'nat', enabled: false, entities: [{ entity: 'port-forward', count: 1 }], derivedFlows: 0 },
    ],
  },
  play: async () => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await expect(dialog()).toHaveTextContent(text(t('workspaceExtensions.alsoOff', { names: nat() })));
    await expect(dialog()).toHaveTextContent(text(t('workspaceExtensions.entityCount', {
      type: t('extensions.nat.entitiesPlural.port-forward'), count: 1,
    })));
  },
};

/** Turning on an extension whose dependencies are off names them, and confirms with Turn on (30). */
export const TurnOnWithDependencies: Story = {
  args: {
    extension: 'reverse-proxy',
    enabled: true,
    changes: [
      { id: 'reverse-proxy', enabled: true, entities: [], derivedFlows: 0 },
      { id: 'nat', enabled: true, entities: [], derivedFlows: 0 },
    ],
  },
  play: async ({ args }) => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await expect(within(dialog()).getByRole('heading', {
      name: t('workspaceExtensions.confirmOnTitle', { name: t('extensions.reverse-proxy.name') }),
    })).toBeVisible();
    await expect(dialog()).toHaveTextContent(text(t('workspaceExtensions.alsoOn', { names: nat() })));
    await expect(dialog()).not.toHaveTextContent(text(t('workspaceExtensions.nothingDeleted')));
    await userEvent.click(within(dialog()).getByRole('button', { name: t('workspaceExtensions.turnOn') }));
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};
