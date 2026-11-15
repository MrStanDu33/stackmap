import { expect, userEvent, waitFor, within } from 'storybook/test';

import HostForm from './HostForm.vue';
import { COMMON_DEFAULTS, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { HOSTS, IDS, pick } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/Core/HostForm',
  component: HostForm,
  args: formArgs('host-form'),
  render: formRender(HostForm),
} satisfies Meta<typeof HostForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const kind = (id: string) => t(`extensions.core.kinds.host.${id}`);
// Numbered through their own keys: the language sets where the number goes (review).
const address = (canvasElement: HTMLElement, n: number) => within(canvasElement)
  .getByRole('textbox', { name: new RegExp(`^${t('extensions.core.fields.host.addressNumbered', { number: n })}`) });
const network = (canvasElement: HTMLElement, n: number, role: 'combobox' | 'textbox' = 'combobox') => within(canvasElement)
  .getByRole(role, { name: new RegExp(`^${t('extensions.core.fields.host.networkNumbered', { number: n })}`) });

/** A new host: name, kind, OS, site and no address yet; empty optional fields as null (39). */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(fieldOf(canvasElement, 'textbox', 'host', 'name'), 'backup');
    await pick(fieldOf(canvasElement, 'combobox', 'host', 'kind'), kind('vm'));
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'backup', kind: 'vm', os: null, siteId: null, addresses: [], ...COMMON_DEFAULTS,
    });
  },
};

/** Editing: the host's values, its addresses with their networks (22). */
export const Editing: Story = {
  args: { entity: HOSTS[0] },
  play: async ({ canvasElement, args }) => {
    await expect(fieldOf(canvasElement, 'textbox', 'host', 'os')).toHaveValue('Debian 13');
    await expect(address(canvasElement, 1)).toHaveValue('192.0.2.10');
    await expect(network(canvasElement, 1)).toHaveTextContent('LAN');
    await userEvent.clear(fieldOf(canvasElement, 'textbox', 'host', 'os'));
    await expect(args.onDirty).toHaveBeenLastCalledWith(true);
    await save(canvasElement);
    await expect(args.onSubmit)
      .toHaveBeenCalledWith(expect.objectContaining({ os: null, addresses: HOSTS[0]?.addresses }));
  },
};

/** Addresses: Add an address gives a focused address field and its network; Remove takes it away (39). */
export const Addresses: Story = {
  args: { entity: HOSTS[0] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('extensions.core.fields.host.addAddress') }));
    await expect(address(canvasElement, 2)).toHaveFocus();
    await userEvent.type(address(canvasElement, 2), '192.0.2.20');
    await pick(network(canvasElement, 2), 'LAN');
    await userEvent.click(canvas.getByRole('button', { name: t('extensions.core.fields.host.removeAddress', { number: 1 }) }));
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      addresses: [{ address: '192.0.2.20', networkId: IDS.lan }],
    }));
    // The removed row's button had the focus: it goes to the row now in its place (review).
    await waitFor(() => expect(canvas.getByRole('button', { name: t('extensions.core.fields.host.removeAddress', { number: 1 }) }))
      .toHaveFocus());
    // The last row removed: to Add an address.
    await userEvent.click(canvas.getByRole('button', { name: t('extensions.core.fields.host.removeAddress', { number: 1 }) }));
    await waitFor(() => expect(canvas.getByRole('button', { name: t('extensions.core.fields.host.addAddress') })).toHaveFocus());
  },
};

/** An issue on the addresses as a whole: tied to their group, which the summary can link to (review). */
export const GroupIssue: Story = {
  args: { entity: HOSTS[0], issues: { addresses: ['At most 32 addresses'] } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: t('extensions.core.fields.host.addresses') });
    await expect(group).toHaveAccessibleDescription(expect.stringContaining('At most 32 addresses') as string);
    await expect(group).toHaveAttribute('id', 'host-form-addresses');
  },
};

/** At most 32 addresses: Add an address is gone at 32 (39). */
export const AddressLimit: Story = {
  args: {
    entity: { ...HOSTS[0], addresses: Array.from({ length: 32 }, (_, index) => ({ address: `192.0.2.${String(index + 10)}`, networkId: null })) },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: t('extensions.core.fields.host.addAddress') })).toBeNull();
  },
};

/** An address's issue under that address (25, 27). */
export const WithIssues: Story = {
  args: {
    entity: { ...HOSTS[0], addresses: [{ address: '192.0.2.10', networkId: null }, { address: '192.0.2.10', networkId: null }] },
    issues: { 'addresses.1.address': ['192.0.2.10 is listed twice'], kind: ['Required'] },
  },
  play: async ({ canvasElement }) => {
    await expect(address(canvasElement, 2)).toHaveAttribute('aria-invalid', 'true');
    await expect(address(canvasElement, 2)).toHaveAttribute('id', 'host-form-addresses-1-address');
    await expect(address(canvasElement, 2)).toHaveAccessibleDescription(expect.stringContaining('listed twice') as string);
    await expect(address(canvasElement, 1)).not.toHaveAttribute('aria-invalid', 'true');
    await expect(fieldOf(canvasElement, 'combobox', 'host', 'kind')).toHaveAttribute('aria-invalid', 'true');
  },
};

/** Read-only for viewers: nothing to add or remove (18). */
export const ReadOnly: Story = {
  args: { entity: HOSTS[0], readonly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(address(canvasElement, 1)).toHaveAttribute('readonly');
    await expect(canvas.queryByRole('button', { name: t('extensions.core.fields.host.addAddress') })).toBeNull();
    await expect(fieldOf(canvasElement, 'textbox', 'host', 'kind')).toHaveValue(kind('physical'));
    await expect(network(canvasElement, 1, 'textbox')).toHaveValue('LAN');
    // Values as read-only text, reachable and at full contrast: no disabled controls (review).
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
  },
};
