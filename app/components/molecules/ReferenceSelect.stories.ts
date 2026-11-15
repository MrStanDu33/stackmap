import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import ReferenceSelect from './ReferenceSelect.vue';
import { IDS, optionTexts, pick, REFERENCES } from '../../../.storybook/inventory';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Molecules/ReferenceSelect',
  component: ReferenceSelect,
  args: {
    id: 'host-form-siteId',
    label: 'Site',
    modelValue: null,
    items: REFERENCES['core/site'] ?? [],
    nullable: true,
    required: false,
    errors: [],
    readonly: false,
    'onUpdate:modelValue': fn(),
  },
  // Errors are i18n keys, translated when the story renders: in its locale.
  render: (args) => ({
    components: { ReferenceSelect },
    // Props reach stories untyped from the .vue file: typed here.
    setup: () => ({ args: { ...args, errors: (args.errors as string[]).map((key) => t(key)) } }),
    template: '<ReferenceSelect v-bind="args" />',
  }),
} satisfies Meta<typeof ReferenceSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

const select = (canvasElement: HTMLElement, name: RegExp | string = /^Site/) =>
  within(canvasElement).getByRole('combobox', { name });

/** A nullable reference: None first, then the entities by name; picking one sends its id, None sends null (35). */
export const Nullable: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(await optionTexts(select(canvasElement))).toEqual([t('inventory.none'), 'Home', 'Office']);
    await pick(select(canvasElement), 'Office');
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(IDS.office);
  },
};

/** The current value shows by its name; None clears it (35). */
export const Chosen: Story = {
  args: { modelValue: IDS.home },
  play: async ({ canvasElement, args }) => {
    await expect(select(canvasElement)).toHaveTextContent('Home');
    await pick(select(canvasElement), t('inventory.none'));
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(null);
  },
};

/** A required reference has no None, and says it is required in its name, not only with a mark (35). */
export const Required: Story = {
  args: { nullable: false, required: true, label: 'Service', id: 'listener-form-serviceId', items: REFERENCES['core/service'] ?? [] },
  play: async ({ canvasElement }) => {
    const combobox = select(canvasElement, new RegExp(`^Service.*${t('inventory.required')}`));
    await expect(await optionTexts(combobox)).toEqual(['Blog', 'Blog database']);
  },
};

/** Listeners read as "<service> :<port>/<transport>" (35). */
export const ListenerLabels: Story = {
  args: { label: 'Listener', id: 'flow-form-targetListenerId', items: REFERENCES['core/listener'] ?? [], nullable: false },
  play: async ({ canvasElement }) => {
    await expect(await optionTexts(select(canvasElement, /^Listener/))).toEqual(['Blog :3000/tcp', 'Blog database :5432/tcp']);
  },
};

/** Typing narrows the options (35). */
export const Searching: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(select(canvasElement));
    await userEvent.keyboard('off');
    await waitFor(() => expect([...document.querySelectorAll('[role="option"]')].map(({ textContent }) => textContent.trim()))
      .toEqual(['Office']));
    // Closed again, as the other stories do, before the page is checked with axe.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[role="listbox"]')).toBeNull());
  },
};

/** An error is said in the field's description, and the field is marked invalid (25). */
export const WithError: Story = {
  args: { errors: ['inventory.referenceGone'] },
  play: async ({ canvasElement }) => {
    await expect(select(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(select(canvasElement)).toHaveAccessibleDescription(expect.stringContaining(t('inventory.referenceGone')) as string);
  },
};

/** Read-only for viewers: shown, not changeable (18). */
export const ReadOnly: Story = {
  args: { readonly: true, modelValue: IDS.home },
  play: async ({ canvasElement }) => {
    await expect(select(canvasElement)).toBeDisabled();
    await expect(select(canvasElement)).toHaveTextContent('Home');
  },
};
