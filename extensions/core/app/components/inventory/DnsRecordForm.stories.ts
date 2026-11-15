import { expect, userEvent, within } from 'storybook/test';

import DnsRecordForm from './DnsRecordForm.vue';
import { COMMON_DEFAULTS, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { DNS_RECORDS, IDS, pick } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/Core/DnsRecordForm',
  component: DnsRecordForm,
  args: formArgs('dns-record-form'),
  render: formRender(DnsRecordForm),
} satisfies Meta<typeof DnsRecordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const value = (canvasElement: HTMLElement) => fieldOf(canvasElement, 'textbox', 'dns-record', 'value');

/** A new record: domain, name, type (A by default), value, view (public by default) and proxied (43). */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    await pick(fieldOf(canvasElement, 'combobox', 'dns-record', 'domainId'), 'homelab.example');
    await userEvent.type(fieldOf(canvasElement, 'textbox', 'dns-record', 'name'), 'www');
    await userEvent.type(value(canvasElement), '203.0.113.10');
    await userEvent.click(fieldOf(canvasElement, 'checkbox', 'dns-record', 'proxied'));
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      domainId: IDS.domain, name: 'www', type: 'A', value: '203.0.113.10', view: 'public', proxied: true, ...COMMON_DEFAULTS,
    });
  },
};

/** The value's hint follows the type: an IPv4 address for A, an IPv6 one for AAAA (43). */
export const ValueHint: Story = {
  play: async ({ canvasElement }) => {
    await expect(value(canvasElement)).toHaveAccessibleDescription(t('extensions.core.fields.dns-record.valueHint.A'));
    await pick(fieldOf(canvasElement, 'combobox', 'dns-record', 'type'), 'AAAA');
    await expect(value(canvasElement)).toHaveAccessibleDescription(t('extensions.core.fields.dns-record.valueHint.AAAA'));
  },
};

/** Editing: the record's values, its view translated (22). */
export const Editing: Story = {
  args: { entity: DNS_RECORDS[0] },
  play: async ({ canvasElement, args }) => {
    await expect(value(canvasElement)).toHaveValue('203.0.113.10');
    await expect(fieldOf(canvasElement, 'combobox', 'dns-record', 'view')).toHaveTextContent(t('extensions.core.dnsViews.public'));
    await pick(fieldOf(canvasElement, 'combobox', 'dns-record', 'view'), t('extensions.core.dnsViews.internal'));
    await expect(args.onDirty).toHaveBeenLastCalledWith(true);
  },
};

/** An issue under its field (25). */
export const WithIssues: Story = {
  args: { entity: DNS_RECORDS[0], issues: { value: [t('extensions.core.issues.invalid-record-value', { type: 'A', expected: 'an IPv4 address' })] } },
  play: async ({ canvasElement }) => {
    await expect(value(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(value(canvasElement)).toHaveAttribute('id', 'dns-record-form-value');
  },
};

/** Read-only for viewers (18). */
export const ReadOnly: Story = {
  args: { entity: DNS_RECORDS[0], readonly: true },
  play: async ({ canvasElement }) => {
    await expect(value(canvasElement)).toHaveAttribute('readonly');
    await expect(fieldOf(canvasElement, 'textbox', 'dns-record', 'proxied')).toHaveValue(t('inventory.no'));
    await expect(fieldOf(canvasElement, 'textbox', 'dns-record', 'view')).toHaveValue(t('extensions.core.dnsViews.public'));
    // Values as read-only text, reachable and at full contrast: no disabled controls (review).
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
    await expect(within(canvasElement).queryByRole('button', { name: t('inventory.save') })).toBeNull();
  },
};
