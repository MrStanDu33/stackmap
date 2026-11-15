import { expect, userEvent, within } from 'storybook/test';

import PortForwardForm from './PortForwardForm.vue';
import { COMMON_DEFAULTS, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { HOSTS, IDS, optionTexts, pick, PORT_FORWARDS, REFERENCES } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/Nat/PortForwardForm',
  component: PortForwardForm,
  args: formArgs('port-forward-form'),
  render: formRender(PortForwardForm),
} satisfies Meta<typeof PortForwardForm>;

export default meta;
type Story = StoryObj<typeof meta>;

type Role = Parameters<typeof fieldOf>[1];
const field = (canvasElement: HTMLElement, role: Role, name: string) => fieldOf(canvasElement, role, 'port-forward', name, 'nat');
const label = (name: string) => t(`extensions.nat.fields.port-forward.${name}`);

/** The fixtures' hosts, plus one without an address and another router that lacks the edge router's addresses. */
type Host = { id: string; name: string; addresses: { address: string; networkId: string | null }[] };
const withHosts = (...hosts: Host[]) => ({
  ...REFERENCES,
  'core/host': [
    ...(REFERENCES['core/host'] ?? []),
    ...hosts.map((host) => ({ id: host.id, label: host.name, entity: { ...HOSTS[0], ...host } })),
  ],
});
const SWITCH = { id: '0199d6a0-0000-7000-8000-000000000012', name: 'switch', addresses: [] };
const BACKUP = {
  id: '0199d6a0-0000-7000-8000-000000000013',
  name: 'Backup router',
  addresses: [{ address: '198.51.100.1', networkId: null }, { address: '192.0.2.2', networkId: null }],
};

/** A new forward: no host, so no address yet; the router's addresses in its order; ports as numbers (9, 10, 11, 16). */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    const external = field(canvasElement, 'combobox', 'externalAddress');

    await expect(external).toHaveAccessibleDescription(label('chooseHostFirst'));
    await pick(field(canvasElement, 'combobox', 'hostId'), 'Edge router');
    await expect(await optionTexts(external)).toEqual(['203.0.113.10', '192.0.2.1']);
    await pick(external, '203.0.113.10');
    await userEvent.type(field(canvasElement, 'spinbutton', 'externalPort'), '443');
    await expect(field(canvasElement, 'combobox', 'transport')).toHaveTextContent(t('extensions.core.transports.tcp'));
    await userEvent.type(field(canvasElement, 'textbox', 'internalAddress'), '192.0.2.10');
    await userEvent.type(field(canvasElement, 'spinbutton', 'internalPort'), '8443');
    // The range is said, since the form does not let the browser check it.
    await expect(field(canvasElement, 'spinbutton', 'externalPort')).toHaveAccessibleDescription(label('portHint'));
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      hostId: IDS.router, externalAddress: '203.0.113.10', externalPort: 443, transport: 'tcp',
      internalAddress: '192.0.2.10', internalPort: 8443, description: null, ...COMMON_DEFAULTS,
    });
  },
};

/** A host with one address: it is picked (14). */
export const SingleAddress: Story = {
  play: async ({ canvasElement }) => {
    await pick(field(canvasElement, 'combobox', 'hostId'), 'nas');
    await expect(field(canvasElement, 'combobox', 'externalAddress')).toHaveTextContent('192.0.2.10');
  },
};

/** Another host without the chosen address clears it (13). */
export const HostChangeClears: Story = {
  args: { references: withHosts(BACKUP) },
  play: async ({ canvasElement }) => {
    const external = field(canvasElement, 'combobox', 'externalAddress');

    await pick(field(canvasElement, 'combobox', 'hostId'), 'Edge router');
    await pick(external, '203.0.113.10');
    await pick(field(canvasElement, 'combobox', 'hostId'), 'Backup router');
    await expect(external).not.toHaveTextContent('203.0.113.10');
    await expect(await optionTexts(external)).toEqual(['198.51.100.1', '192.0.2.2']);
  },
};

/** A host without an address: no choice, and the hint says to add one to the host (12). */
export const HostWithoutAddress: Story = {
  args: { references: withHosts(SWITCH) },
  play: async ({ canvasElement }) => {
    await pick(field(canvasElement, 'combobox', 'hostId'), 'switch');
    await expect(field(canvasElement, 'combobox', 'externalAddress')).toHaveAccessibleDescription(label('hostWithoutAddress'));
  },
};

/** Editing: the forward's values; an address no longer on its host is said unavailable and kept (15). */
export const Editing: Story = {
  args: { entity: { ...PORT_FORWARDS[0], externalAddress: '198.51.100.7' } },
  play: async ({ canvasElement, args }) => {
    await expect(field(canvasElement, 'combobox', 'hostId')).toHaveTextContent('Edge router');
    await expect(field(canvasElement, 'combobox', 'externalAddress'))
      .toHaveTextContent(t('inventory.unavailable', { id: '198.51.100.7' }));
    await expect(field(canvasElement, 'spinbutton', 'externalPort')).toHaveValue(443);
    await expect(field(canvasElement, 'textbox', 'description')).toHaveValue('Blog');
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ externalAddress: '198.51.100.7', internalPort: 8443 }));
  },
};

/** The server's NAT rules under their fields (17). */
export const WithIssues: Story = {
  args: {
    issues: {
      externalAddress: [t('extensions.nat.issues.address-not-on-host')],
      internalAddress: [t('extensions.nat.issues.ip-version-mismatch')],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(field(canvasElement, 'combobox', 'externalAddress')).toHaveAttribute('aria-invalid', 'true');
    await expect(field(canvasElement, 'combobox', 'externalAddress'))
      .toHaveAccessibleDescription(expect.stringContaining(t('extensions.nat.issues.address-not-on-host')) as string);
    await expect(field(canvasElement, 'textbox', 'internalAddress'))
      .toHaveAccessibleDescription(expect.stringContaining(t('extensions.nat.issues.ip-version-mismatch')) as string);
  },
};

/** Read-only for viewers: values as text, the external address too (18). */
export const ReadOnly: Story = {
  args: { entity: PORT_FORWARDS[0], readonly: true },
  play: async ({ canvasElement }) => {
    await expect(field(canvasElement, 'textbox', 'hostId')).toHaveValue('Edge router');
    await expect(field(canvasElement, 'textbox', 'externalAddress')).toHaveValue('203.0.113.10');
    await expect(field(canvasElement, 'spinbutton', 'internalPort')).toHaveAttribute('readonly');
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
    await expect(within(canvasElement).queryByRole('button', { name: t('inventory.save') })).toBeNull();
  },
};
