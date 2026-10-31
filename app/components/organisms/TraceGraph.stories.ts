import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import TraceGraph from './TraceGraph.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { layOutTrace } from '../../../.storybook/traffic';
import { DEMO_TRACE, NOTHING_TRACE } from '../../../tests/support/demo-trace';
import { DEMO_IDS } from '../../../tests/support/demo-traffic';

import type { Trace } from '../../../shared/contracts/traces';
import type { TrafficLayout } from '../../utils/traffic-graph';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { listeners, flows } = DEMO_IDS;

/** The demo trace with one more step: the website calling NPM back, a cycle the walk does not follow. */
const CYCLE_TRACE: Trace = {
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
};

const meta = {
  title: 'Organisms/TraceGraph',
  component: TraceGraph,
  parameters: { layout: 'fullscreen' },
  args: { trace: DEMO_TRACE, layout: null, error: null, selection: null, onSelect: fn(), onRetry: fn() },
  loaders: [async ({ args, globals }) => ({
    layout: await layOutTrace((args.trace as Trace | undefined) ?? DEMO_TRACE, globals.locale),
  })],
  render: (args, { loaded }) => ({
    components: { TraceGraph },
    setup: () => {
      const { layout } = loaded as { layout?: TrafficLayout };
      return { args: { ...args, layout: (args.layout as TrafficLayout | null) ?? layout } };
    },
    template: '<div style="height: 560px"><TraceGraph v-bind="args" /></div>',
  }),
} satisfies Meta<typeof TraceGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

const edgeOf = (canvasElement: HTMLElement, stepId: string) =>
  canvasElement.querySelector<HTMLElement>(`.vue-flow__edge[data-id="step:${stepId}"]`);
const nodeOf = (canvasElement: HTMLElement, id: string) =>
  canvasElement.querySelector<HTMLElement>(`.vue-flow__node[data-id="${id}"]`);
const ready = (canvasElement: HTMLElement, count: number) =>
  waitFor(() => expect(canvasElement.querySelectorAll('.vue-flow__edge')).toHaveLength(count));

/** The client, the five listeners and every step; zoom buttons, then nodes, by Tab; Enter selects a node. */
export const Demo: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await ready(canvasElement, DEMO_TRACE.steps.length);

    await waitFor(() => expect(canvas.getByText(t('traffic.client.public'))).toBeVisible());
    for (const name of ['Website', 'Website database', 'Weather API']) {
      await waitFor(() => expect(canvas.getByText(name)).toBeVisible());
    }
    await expect(canvas.getAllByText('Nginx Proxy Manager')).toHaveLength(2);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: t('traffic.zoomIn') })).toHaveFocus();

    const npm = nodeOf(canvasElement, `listener:${listeners.npmHttps}`);
    await expect(npm).toHaveAttribute('role', 'button');
    npm?.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'listener', id: listeners.npmHttps });
  },
};

/** A selected step: it and its two ends are highlighted and pressed; every other step is dimmed. */
export const SelectedStep: Story = {
  args: { selection: { type: 'step', id: `${flows.publicHttps}:client` } },
  play: async ({ canvasElement }) => {
    await ready(canvasElement, DEMO_TRACE.steps.length);

    await waitFor(() => expect(canvasElement.querySelectorAll('[data-step-state="highlighted"]')).toHaveLength(1));
    await expect(canvasElement.querySelectorAll('[data-step-state="dimmed"]')).toHaveLength(DEMO_TRACE.steps.length - 1);
    await expect(nodeOf(canvasElement, 'client')).toHaveAttribute('aria-pressed', 'true');
    await expect(nodeOf(canvasElement, `listener:${listeners.npmHttps}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(nodeOf(canvasElement, `listener:${listeners.website}`)).toHaveAttribute('aria-pressed', 'false');
  },
};

/** Dependencies are dashed and say their level, never by color alone. */
export const Dependencies: Story = {
  play: async ({ canvasElement }) => {
    await ready(canvasElement, DEMO_TRACE.steps.length);
    const database = edgeOf(canvasElement, `${flows.database}:${listeners.website}`);

    await expect(canvasElement.querySelectorAll('[data-step-kind="dependency"]')).toHaveLength(2);
    await expect(database).toHaveAttribute('aria-label', t('trace.dependencyStep', {
      step: t('trace.step', { source: 'Website', service: 'Website database', port: '5432/tcp' }), depth: 1,
    }));
    await expect(database?.querySelector('path')?.getAttribute('stroke-dasharray')).toBeTruthy();
  },
};

/** A cycle is drawn apart and says it goes back without being followed. */
export const Cycle: Story = {
  args: { trace: CYCLE_TRACE },
  play: async ({ canvasElement }) => {
    await ready(canvasElement, CYCLE_TRACE.steps.length);

    await expect(canvasElement.querySelectorAll('[data-step-kind="cycle"]')).toHaveLength(1);
    await expect(edgeOf(canvasElement, `${flows.internalHttp}:${listeners.website}`)?.getAttribute('aria-label'))
      .toContain('Nginx Proxy Manager 80/tcp');
  },
};

export const Loading: Story = {
  loaders: [],
  args: { layout: null },
  render: (args) => ({
    components: { TraceGraph },
    setup: () => ({ args }),
    template: '<div style="height: 560px"><TraceGraph v-bind="args" /></div>',
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status'))
      .toHaveTextContent(t('trace.loading', { hostname: 'app.homelab.example' }));
  },
};

/** Nothing reaches the name: the client alone, and a message saying so. */
export const Empty: Story = {
  args: { trace: NOTHING_TRACE },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(t('trace.nothing', {
      hostname: 'nowhere.homelab.example', client: t('traffic.client.public'),
    }))).toBeVisible();
  },
};

export const LayoutError: Story = {
  loaders: [],
  args: { layout: null, error: new Error('Worker crashed') },
  render: (args) => ({
    components: { TraceGraph },
    setup: () => ({ args }),
    template: '<div style="height: 560px"><TraceGraph v-bind="args" /></div>',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('alert')).toHaveTextContent(t('traffic.layoutError'));
    await userEvent.click(canvas.getByRole('button', { name: t('common.retry') }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
