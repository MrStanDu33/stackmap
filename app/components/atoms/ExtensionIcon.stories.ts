import { expect, waitFor } from 'storybook/test';

import ExtensionIcon from './ExtensionIcon.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const FALLBACK = 'i-lucide-puzzle';

/** A small image, inline so the story needs no file. */
const IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#7c3aed"/></svg>',
)}`;

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
    await expectDecorative(element);
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

/** An image that fails to load: the generic fallback replaces it. */
export const BrokenImage: Story = {
  args: { icon: '/extensions/missing/icon.svg' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shownIcon(canvasElement)).toHaveAttribute('data-icon', FALLBACK));
    await expectDecorative(shownIcon(canvasElement));
  },
};
