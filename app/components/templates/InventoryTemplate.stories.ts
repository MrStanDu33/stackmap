import { expect, within } from 'storybook/test';

import InventoryTemplate from './InventoryTemplate.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;
const plural = (extension: string, entity: string) => t(`extensions.${extension}.entitiesPlural.${entity}`);

const GROUPS = [
  {
    extension: 'core',
    label: t('extensions.core.name'),
    types: ['site', 'network', 'host'].map((entity) => ({
      key: `core/${entity}`, label: plural('core', entity), to: `/w/home/inventory/core/${entity}`,
    })),
  },
  {
    extension: 'nat',
    label: t('extensions.nat.name'),
    types: [{ key: 'nat/port-forward', label: plural('nat', 'port-forward'), to: '/w/home/inventory/nat/port-forward' }],
  },
];

const meta = {
  title: 'Templates/InventoryTemplate',
  component: InventoryTemplate,
  args: { groups: GROUPS, current: 'core/host', title: plural('core', 'host'), notFound: false, backTo: '/w/home/inventory' },
  render: (args) => ({
    components: { InventoryTemplate },
    setup: () => ({ args }),
    template: '<InventoryTemplate v-bind="args"><p>Table</p></InventoryTemplate>',
  }),
} satisfies Meta<typeof InventoryTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The type navigation, grouped by extension, the current type marked as the page; the content beside it (3). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = within(canvas.getByRole('navigation', { name: t('inventory.types') }));

    await expect(nav.getByText(t('extensions.core.name'))).toBeVisible();
    await expect(nav.getByText(t('extensions.nat.name'))).toBeVisible();
    await expect(nav.getAllByRole('link').map(({ textContent }) => textContent.trim()))
      .toEqual([plural('core', 'site'), plural('core', 'network'), plural('core', 'host'), plural('nat', 'port-forward')]);
    await expect(nav.getByRole('link', { name: plural('core', 'host') })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: plural('core', 'site') })).not.toHaveAttribute('aria-current');
    await expect(canvas.getByRole('heading', { level: 1, name: plural('core', 'host') })).toBeVisible();
    await expect(canvas.getByText('Table')).toBeVisible();
  },
};

/** A type not in the inventory: said, with a link back, and no content (4). */
export const NotFound: Story = {
  args: { notFound: true, current: undefined, title: t('inventory.notFound') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { level: 1, name: t('inventory.notFound') })).toBeVisible();
    await expect(canvas.getByRole('link', { name: t('inventory.back') })).toHaveAttribute('href', '/w/home/inventory');
    await expect(canvas.queryByText('Table')).toBeNull();
  },
};
