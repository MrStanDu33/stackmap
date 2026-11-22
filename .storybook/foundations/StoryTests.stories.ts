import { expect, within } from 'storybook/test';
import { onMounted, ref } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Foundations/Story tests',
  // What the story tests' browser is like (deterministic-stories spec): run in every project, not a page to read.
  tags: ['!dev'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A wait lasts until the UI is ready: an element shown after 1.5 s, past Testing Library's old 1 s, is found. */
export const WaitsLongerThanASecond: Story = {
  render: () => ({
    setup: () => {
      const ready = ref(false);
      onMounted(() => setTimeout(() => {
        ready.value = true;
      }, 1500));
      return { ready };
    },
    template: '<p v-if="ready">Ready</p>',
  }),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Ready')).toBeVisible();
  },
};

/** The browser prefers reduced motion, so a transition ends at once: no story checks an element mid-animation. */
export const TransitionsEndAtOnce: Story = {
  render: () => ({
    template: '<p style="transition: opacity 2s">Fading</p>',
  }),
  play: async ({ canvasElement }) => {
    await expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    // a11y.css shortens every transition to 0.01 ms under reduced motion.
    await expect(getComputedStyle(within(canvasElement).getByText('Fading')).transitionDuration).toBe('1e-05s');
  },
};
