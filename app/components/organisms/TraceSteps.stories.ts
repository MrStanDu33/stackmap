import { expect, fn, userEvent, within } from 'storybook/test';

import TraceSteps from './TraceSteps.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { DEMO_TRACE } from '../../../tests/support/demo-trace';
import { DEMO_IDS } from '../../../tests/support/demo-traffic';

import type { Trace } from '../../../shared/contracts/traces';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { listeners, flows } = DEMO_IDS;

const meta = {
  title: 'Organisms/TraceSteps',
  component: TraceSteps,
  args: { trace: DEMO_TRACE, selection: null, onSelect: fn() },
} satisfies Meta<typeof TraceSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
// getByText collapses the page's whitespace, French non-breaking spaces included: expected text is collapsed alike.
const spaced = (text: string) => text.replace(/\s+/g, ' ');

/** The request in order, each step with its hops as sentences, then the dependencies by level. */
export const Demo: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const request = canvas.getByRole('region', { name: t('trace.request') });
    const dependencies = canvas.getByRole('region', { name: t('trace.level', { depth: 1 }) });
    const first = within(request).getByRole('button', {
      name: t('trace.step', { source: t('traffic.client.public'), service: 'Nginx Proxy Manager', port: '80/tcp' }),
    });

    const hops = within(first.closest('li') ?? request).getAllByRole('listitem')
      .map(({ textContent }) => textContent.trim());
    await expect(hops).toEqual([
      expect.stringContaining('app.homelab.example') as unknown as string,
      expect.stringContaining('203.0.113.10:80/tcp') as unknown as string,
    ]);
    await expect(within(dependencies).getAllByRole('button')).toHaveLength(2);

    await userEvent.click(first);
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'step', id: `${flows.publicHttp}:client` });
  },
};

/** A cycle is written out: where it goes back to, and that the walk stops there. */
export const Cycle: Story = {
  args: {
    trace: {
      ...DEMO_TRACE,
      steps: [...DEMO_TRACE.steps, {
        id: `${flows.internalHttp}:${listeners.website}`, source: listeners.website, target: listeners.npmHttp,
        role: 'dependency', depth: 1, cycle: true,
        flow: {
          id: flows.internalHttp, origin: 'manual', extension: null, deriver: null, protocol: null, encrypted: null,
          purpose: null,
        },
        hops: [],
      }],
    } satisfies Trace,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(spaced(t('trace.cycleNote', { target: 'Nginx Proxy Manager 80/tcp' }))))
      .toBeVisible();
  },
};

export const Selected: Story = {
  args: { selection: { type: 'step', id: `${flows.publicHttps}:client` } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', {
      name: t('trace.step', { source: t('traffic.client.public'), service: 'Nginx Proxy Manager', port: '443/tcp' }),
    })).toHaveAttribute('aria-current', 'true');
  },
};
