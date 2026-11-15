import { expect, userEvent, within } from 'storybook/test';

import ServiceForm from './ServiceForm.vue';
import { COMMON_DEFAULTS, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { IDS, optionTexts, pick, SERVICES } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/Core/ServiceForm',
  component: ServiceForm,
  args: formArgs('service-form'),
  render: formRender(ServiceForm),
} satisfies Meta<typeof ServiceForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const kind = (id: string) => t(`extensions.core.kinds.service.${id}`);

/** A new service: name, kind, host, image and container name; empty optional fields as null (40). */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(fieldOf(canvasElement, 'textbox', 'service', 'name'), 'Wiki');
    await pick(fieldOf(canvasElement, 'combobox', 'service', 'kind'), kind('app'));
    await pick(fieldOf(canvasElement, 'combobox', 'service', 'hostId'), 'nas');
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'Wiki', kind: 'app', hostId: IDS.nas, image: null, containerName: null, ...COMMON_DEFAULTS,
    });
  },
};

/** Editing: the service's values; the host is optional, None clears it (22, 35). */
export const Editing: Story = {
  args: { entity: SERVICES[0] },
  play: async ({ canvasElement, args }) => {
    await expect(fieldOf(canvasElement, 'textbox', 'service', 'image')).toHaveValue('ghcr.io/example/blog:1.4');
    await expect(await optionTexts(fieldOf(canvasElement, 'combobox', 'service', 'hostId')))
      .toEqual([t('inventory.none'), 'nas', 'Edge router']);
    await pick(fieldOf(canvasElement, 'combobox', 'service', 'hostId'), t('inventory.none'));
    await expect(args.onDirty).toHaveBeenLastCalledWith(true);
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ hostId: null }));
  },
};

/** An issue under its field (25). */
export const WithIssues: Story = {
  args: { issues: { image: ['Too long'] } },
  play: async ({ canvasElement }) => {
    await expect(fieldOf(canvasElement, 'textbox', 'service', 'image')).toHaveAttribute('aria-invalid', 'true');
    await expect(fieldOf(canvasElement, 'textbox', 'service', 'image')).toHaveAttribute('id', 'service-form-image');
  },
};

/** Read-only for viewers (18). */
export const ReadOnly: Story = {
  args: { entity: SERVICES[0], readonly: true },
  play: async ({ canvasElement }) => {
    await expect(fieldOf(canvasElement, 'textbox', 'service', 'name')).toHaveAttribute('readonly');
    await expect(fieldOf(canvasElement, 'textbox', 'service', 'hostId')).toHaveValue('nas');
    // Values as read-only text, reachable and at full contrast: no disabled controls (review).
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
    await expect(within(canvasElement).queryByRole('button', { name: t('inventory.save') })).toBeNull();
  },
};
