import { expect, userEvent, within } from 'storybook/test';

import NetworkForm from './NetworkForm.vue';
import { COMMON_DEFAULTS, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { NETWORKS, IDS, pick } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/Core/NetworkForm',
  component: NetworkForm,
  args: formArgs('network-form'),
  render: formRender(NetworkForm),
} satisfies Meta<typeof NetworkForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const kind = (id: string) => t(`extensions.core.kinds.network.${id}`);

/** A new network: name, kind, CIDR, VLAN and site; Save submits it, empty optional fields as null (38). */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(fieldOf(canvasElement, 'textbox', 'network', 'name'), 'DMZ');
    await pick(fieldOf(canvasElement, 'combobox', 'network', 'kind'), kind('dmz'));
    await userEvent.type(fieldOf(canvasElement, 'textbox', 'network', 'cidr'), '198.51.100.0/24');
    await pick(fieldOf(canvasElement, 'combobox', 'network', 'siteId'), 'Home');
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'DMZ', kind: 'dmz', cidr: '198.51.100.0/24', vlan: null, siteId: IDS.home, ...COMMON_DEFAULTS,
    });
  },
};

/** Editing: the network's values, its site by name (22, 35). */
export const Editing: Story = {
  args: { entity: NETWORKS[0] },
  play: async ({ canvasElement, args }) => {
    await expect(fieldOf(canvasElement, 'textbox', 'network', 'cidr')).toHaveValue('192.0.2.0/24');
    await expect(fieldOf(canvasElement, 'spinbutton', 'network', 'vlan')).toHaveValue(10);
    await expect(fieldOf(canvasElement, 'combobox', 'network', 'siteId')).toHaveTextContent('Home');
    await expect(fieldOf(canvasElement, 'combobox', 'network', 'kind')).toHaveTextContent(kind('lan'));
    await userEvent.clear(fieldOf(canvasElement, 'spinbutton', 'network', 'vlan'));
    await expect(args.onDirty).toHaveBeenLastCalledWith(true);
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ vlan: null }));
  },
};

/** Issues under their fields (25). */
export const WithIssues: Story = {
  args: { issues: { cidr: ['Expected a CIDR'], vlan: ['Must be at most 4094'] } },
  play: async ({ canvasElement }) => {
    await expect(fieldOf(canvasElement, 'textbox', 'network', 'cidr')).toHaveAccessibleDescription(expect.stringContaining('Expected a CIDR') as string);
    await expect(fieldOf(canvasElement, 'spinbutton', 'network', 'vlan')).toHaveAttribute('aria-invalid', 'true');
  },
};

/** Read-only for viewers (18). */
export const ReadOnly: Story = {
  args: { entity: NETWORKS[0], readonly: true },
  play: async ({ canvasElement }) => {
    await expect(fieldOf(canvasElement, 'textbox', 'network', 'name')).toHaveAttribute('readonly');
    await expect(fieldOf(canvasElement, 'combobox', 'network', 'kind')).toBeDisabled();
    await expect(within(canvasElement).queryByRole('button', { name: t('inventory.save') })).toBeNull();
  },
};
