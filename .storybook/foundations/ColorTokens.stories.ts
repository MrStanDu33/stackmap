import { expect, within } from 'storybook/test';

import ColorTokens from './ColorTokens.vue';
import { CONTRAST_PAIRS } from '../../shared/design/contrast';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Foundations/Color tokens',
  component: ColorTokens,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ColorTokens>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Palettes and the contrast of every semantic token pair, measured on the live CSS of the current theme and contrast
 * mode. Runs in every theme × contrast × locale, so it checks the real cascade, Nuxt UI's own layers included.
 */
export const ContrastMatrix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = await canvas.findAllByTestId('contrast-row');

    await expect(rows).toHaveLength(CONTRAST_PAIRS.length);
    const failures = rows
      .filter((row) => row.dataset.result !== 'pass')
      .map((row) => [...(row as HTMLTableRowElement).cells].map((cell) => cell.textContent.trim()).join(' | '));
    await expect(failures).toEqual([]);
  },
};
