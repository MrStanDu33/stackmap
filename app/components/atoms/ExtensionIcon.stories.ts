import { expect, waitFor, within } from 'storybook/test';

import ExtensionIcon from './ExtensionIcon.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const FALLBACK = 'i-lucide-puzzle';

/** An image an extension ships, served from .storybook/public/ as the app serves extension layers' public/. */
const IMAGE = '/extensions/storybook/icon.svg';

const meta = {
  title: 'Atoms/ExtensionIcon',
  component: ExtensionIcon,
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { ExtensionIcon },
    setup: () => ({ args }),
    template: '<ExtensionIcon v-bind="args" class="size-8" />',
  }),
} satisfies Meta<typeof ExtensionIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The element the atom rendered, with the icon it shows in data-icon. */
const shownIcon = (canvasElement: HTMLElement) => {
  const element = canvasElement.querySelector<HTMLElement>('[data-icon]');
  if (!element) {
    throw new Error('ExtensionIcon rendered no [data-icon] element');
  }
  return element;
};

/** Decorative: hidden from assistive technologies, and images have an empty alt. */
const expectDecorative = async (element: HTMLElement) => {
  // What a screen reader gets: no image at all.
  await expect(within(element.parentElement ?? element).queryByRole('img')).toBeNull();
  await expect(element).toHaveAttribute('aria-hidden', 'true');
  if (element instanceof HTMLImageElement) {
    await expect(element).toHaveAttribute('alt', '');
  }
};

/** A Lucide icon, rendered as an inline SVG from the bundled collection. */
export const Lucide: Story = {
  args: { icon: 'i-lucide-router' },
  play: async ({ canvasElement }) => {
    const element = shownIcon(canvasElement);

    await expect(element).toHaveAttribute('data-icon', 'i-lucide-router');
    // In Storybook (plain Vue) UIcon renders an inline SVG; in the app it is a CSS-masked span.
    await waitFor(() => expect(element.closest('svg') ?? element.querySelector('svg')).not.toBeNull());
    await expectDecorative(element);
  },
};

/** An image the extension ships. */
export const Image: Story = {
  args: { icon: IMAGE },
  play: async ({ canvasElement }) => {
    const element = shownIcon(canvasElement);

    await expect(element).toBeInstanceOf(HTMLImageElement);
    await expect(element).toHaveAttribute('src', IMAGE);
    // The size class of the caller wins over the default size.
    await expect(element.getBoundingClientRect().width).toBe(32);
    await expectDecorative(element);
  },
};

/** An image without a size class is 1em, like icons, so it follows the text size. */
export const ImageDefaultSize: Story = {
  args: { icon: IMAGE },
  render: (args) => ({
    components: { ExtensionIcon },
    setup: () => ({ args }),
    template: '<span style="font-size: 20px"><ExtensionIcon v-bind="args" /></span>',
  }),
  play: async ({ canvasElement }) => {
    const { width, height } = shownIcon(canvasElement).getBoundingClientRect();

    await expect({ width, height }).toEqual({ width: 20, height: 20 });
  },
};

/** No icon: the generic fallback. */
export const NoIcon: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const element = shownIcon(canvasElement);

    await expect(element).toHaveAttribute('data-icon', FALLBACK);
    await expectDecorative(element);
  },
};

/** A remote image is never loaded: the generic fallback replaces it. */
export const RemoteImage: Story = {
  args: { icon: 'https://cdn.example/icon.svg' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('img')).toBeNull();
    await expect(shownIcon(canvasElement)).toHaveAttribute('data-icon', FALLBACK);
  },
};

/** An image that fails to load: the generic fallback replaces it. */
export const BrokenImage: Story = {
  args: { icon: '/extensions/missing/icon.svg' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shownIcon(canvasElement)).toHaveAttribute('data-icon', FALLBACK));
    await expectDecorative(shownIcon(canvasElement));
  },
};
