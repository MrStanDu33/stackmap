import { expect, userEvent, within } from 'storybook/test';

import ListenerForm from './ListenerForm.vue';
import { COMMON_DEFAULTS, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { IDS, LISTENERS, pick } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/Core/ListenerForm',
  component: ListenerForm,
  args: formArgs('listener-form'),
  render: formRender(ListenerForm),
} satisfies Meta<typeof ListenerForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const protocol = (id: string) => t(`extensions.core.kinds.protocol.${id}`);

/** A new listener: service, port, transport (TCP), protocol, bind address (every address), published port (41). */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    await pick(fieldOf(canvasElement, 'combobox', 'listener', 'serviceId'), 'Blog');
    await userEvent.type(fieldOf(canvasElement, 'spinbutton', 'listener', 'port'), '443');
    await expect(fieldOf(canvasElement, 'combobox', 'listener', 'transport')).toHaveTextContent(t('extensions.core.transports.tcp'));
    await pick(fieldOf(canvasElement, 'combobox', 'listener', 'protocol'), protocol('https'));
    await expect(fieldOf(canvasElement, 'textbox', 'listener', 'bindAddress')).toHaveValue('0.0.0.0');
    // The range is said, since the form does not let the browser check it (review).
    await expect(fieldOf(canvasElement, 'spinbutton', 'listener', 'port'))
      .toHaveAccessibleDescription(t('extensions.core.fields.listener.portHint'));
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      serviceId: IDS.blog, port: 443, transport: 'tcp', protocol: 'https', bindAddress: '0.0.0.0', publishedPort: null,
      ...COMMON_DEFAULTS,
    });
  },
};

/** Editing: the listener's values; the protocol is optional, None clears it (22, 36). */
export const Editing: Story = {
  args: { entity: LISTENERS[0] },
  play: async ({ canvasElement, args }) => {
    await expect(fieldOf(canvasElement, 'spinbutton', 'listener', 'port')).toHaveValue(3000);
    await expect(fieldOf(canvasElement, 'spinbutton', 'listener', 'publishedPort')).toHaveValue(8080);
    await expect(fieldOf(canvasElement, 'combobox', 'listener', 'protocol')).toHaveTextContent(protocol('http'));
    await pick(fieldOf(canvasElement, 'combobox', 'listener', 'protocol'), t('inventory.none'));
    await expect(args.onDirty).toHaveBeenLastCalledWith(true);
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ protocol: null }));
  },
};

/** Issues under their fields (25). */
export const WithIssues: Story = {
  args: { issues: { port: ['Must be at most 65535'], publishedPort: ['A published port needs a bind address'] } },
  play: async ({ canvasElement }) => {
    await expect(fieldOf(canvasElement, 'spinbutton', 'listener', 'port')).toHaveAttribute('aria-invalid', 'true');
    await expect(fieldOf(canvasElement, 'spinbutton', 'listener', 'publishedPort'))
      .toHaveAccessibleDescription(expect.stringContaining('needs a bind address') as string);
  },
};

/** Read-only for viewers (18). */
export const ReadOnly: Story = {
  args: { entity: LISTENERS[0], readonly: true },
  play: async ({ canvasElement }) => {
    await expect(fieldOf(canvasElement, 'spinbutton', 'listener', 'port')).toHaveAttribute('readonly');
    await expect(fieldOf(canvasElement, 'textbox', 'listener', 'serviceId')).toHaveValue('Blog');
    await expect(fieldOf(canvasElement, 'textbox', 'listener', 'transport')).toHaveValue(t('extensions.core.transports.tcp'));
    // Values as read-only text, reachable and at full contrast: no disabled controls (review).
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
    await expect(within(canvasElement).queryByRole('button', { name: t('inventory.save') })).toBeNull();
  },
};
