import { expect, within } from 'storybook/test';

import FlowForm from './FlowForm.vue';
import { COMMON_DEFAULTS, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { FLOWS, IDS, optionTexts, pick } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/Core/FlowForm',
  component: FlowForm,
  args: formArgs('flow-form'),
  render: formRender(FlowForm),
} satisfies Meta<typeof FlowForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const encrypted = (id: 'unknown' | 'yes' | 'no') => t(`extensions.core.fields.flow.encryptedValues.${id}`);

/** A new flow: source service, target listener ("<service> :<port>/<transport>"), protocol, purpose (44, 35). */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    await pick(fieldOf(canvasElement, 'combobox', 'flow', 'sourceServiceId'), 'Blog');
    await expect(await optionTexts(fieldOf(canvasElement, 'combobox', 'flow', 'targetListenerId')))
      .toEqual(['Blog :3000/tcp', 'Blog database :5432/tcp']);
    await pick(fieldOf(canvasElement, 'combobox', 'flow', 'targetListenerId'), 'Blog database :5432/tcp');
    await expect(fieldOf(canvasElement, 'combobox', 'flow', 'encrypted')).toHaveTextContent(encrypted('unknown'));
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      sourceServiceId: IDS.blog, targetListenerId: IDS.databasePort, protocol: null, purpose: null, encrypted: null,
      ...COMMON_DEFAULTS,
    });
  },
};

/** Editing: the flow's values; encrypted reads yes, no or unknown (22). */
export const Editing: Story = {
  args: { entity: FLOWS[0] },
  play: async ({ canvasElement, args }) => {
    await expect(fieldOf(canvasElement, 'textbox', 'flow', 'purpose')).toHaveValue('Stores the posts');
    await expect(fieldOf(canvasElement, 'combobox', 'flow', 'encrypted')).toHaveTextContent(encrypted('no'));
    await pick(fieldOf(canvasElement, 'combobox', 'flow', 'encrypted'), encrypted('yes'));
    await expect(args.onDirty).toHaveBeenLastCalledWith(true);
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ encrypted: true }));
  },
};

/** An issue under its field (25). */
export const WithIssues: Story = {
  args: { issues: { targetListenerId: [t('inventory.referenceGone')] } },
  play: async ({ canvasElement }) => {
    await expect(fieldOf(canvasElement, 'combobox', 'flow', 'targetListenerId')).toHaveAttribute('aria-invalid', 'true');
    await expect(fieldOf(canvasElement, 'combobox', 'flow', 'targetListenerId')).toHaveAttribute('id', 'flow-form-targetListenerId');
  },
};

/** Read-only for viewers (18). */
export const ReadOnly: Story = {
  args: { entity: FLOWS[0], readonly: true },
  play: async ({ canvasElement }) => {
    await expect(fieldOf(canvasElement, 'textbox', 'flow', 'purpose')).toHaveAttribute('readonly');
    await expect(within(canvasElement).queryByRole('button', { name: t('inventory.save') })).toBeNull();
    // Values as read-only text, reachable and at full contrast: no disabled controls (review).
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
  },
};
