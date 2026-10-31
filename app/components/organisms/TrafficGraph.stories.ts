import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import TrafficGraph from './TrafficGraph.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { layOut } from '../../../.storybook/traffic';
import { DEMO_IDS, DEMO_TRAFFIC } from '../../../tests/support/demo-traffic';

import type { Traffic } from '../../../shared/contracts/traffic';
import type { TrafficLayout } from '../../utils/traffic-graph';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const EMPTY: Traffic = { hosts: [], services: [], listeners: [], flows: [], truncated: false };

const meta = {
  title: 'Organisms/TrafficGraph',
  component: TrafficGraph,
  parameters: { layout: 'fullscreen' },
  args: { traffic: DEMO_TRAFFIC, layout: null, error: null, selection: null, onSelect: fn(), onRetry: fn() },
  loaders: [async () => ({ layout: await layOut(DEMO_TRAFFIC) })],
  render: (args, { loaded }) => ({
    components: { TrafficGraph },
    setup: () => {
      const { layout } = loaded as { layout?: TrafficLayout };
      return { args: { ...args, layout: (args.layout as TrafficLayout | null) ?? layout } };
    },
    template: '<div style="height: 640px"><TrafficGraph v-bind="args" /></div>',
  }),
} satisfies Meta<typeof TrafficGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const { services, flows } = DEMO_IDS;

const nodeOf = (canvasElement: HTMLElement, id: string) => {
  const node = canvasElement.querySelector<HTMLElement>(`.vue-flow__node[data-id="${id}"]`);
  if (!node) {
    throw new Error(`No node ${id}`);
  }
  return node;
};

const flowsIn = (canvasElement: HTMLElement, state: 'highlighted' | 'dimmed') =>
  canvasElement.querySelectorAll(`[data-flow-state="${state}"]`);

/** The demo traffic: clients, hosts, services with their ports and every flow; zoom buttons, then nodes, by Tab. */
export const Demo: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await waitFor(() => expect(canvasElement.querySelectorAll('.vue-flow__edge')).toHaveLength(DEMO_TRAFFIC.flows.length));
    for (const name of ['Edge router', 'Home server', 'Nginx Proxy Manager', 'Website', 'Website database', 'Weather API']) {
      // Vue Flow shows a node once it has measured it, a moment after the edges.
      await waitFor(() => expect(canvas.getByText(name)).toBeVisible());
    }
    await expect(canvas.getByText(t('traffic.client.public'))).toBeVisible();
    await expect(canvas.getByText(t('traffic.client.internal'))).toBeVisible();
    await expect(within(nodeOf(canvasElement, `service:${services.npm}`)).getByText('443/tcp')).toBeVisible();

    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: t('traffic.zoomIn') })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: t('traffic.zoomOut') })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: t('traffic.fit') })).toHaveFocus();

    await expect(nodeOf(canvasElement, `service:${services.npm}`)).toHaveAttribute('role', 'button');
    await expect(nodeOf(canvasElement, `service:${services.npm}`))
      .toHaveAttribute('aria-roledescription', t('traffic.role.service'));
    nodeOf(canvasElement, `service:${services.npm}`).focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'service', id: services.npm });
  },
};

/** A selected service: its seven flows are highlighted, the other two dimmed. */
export const Selected: Story = {
  args: { selection: { type: 'service', id: services.npm } },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(flowsIn(canvasElement, 'highlighted')).toHaveLength(7));
    await expect(flowsIn(canvasElement, 'dimmed')).toHaveLength(2);
    await expect(canvasElement.querySelector(`[data-flow-state="dimmed"][data-flow="${flows.database}"]`)).not.toBeNull();
    // The selected node says so; the others are not pressed.
    await expect(nodeOf(canvasElement, `service:${services.npm}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(nodeOf(canvasElement, `service:${services.website}`)).toHaveAttribute('aria-pressed', 'false');
    // Dimmed flows stay visible (3:1), and lines keep their width whatever the zoom.
    const dimmed = canvasElement.querySelector<SVGPathElement>(`[data-flow="${flows.database}"] path`);
    await expect(Number(dimmed ? getComputedStyle(dimmed).opacity : 0)).toBeGreaterThanOrEqual(0.6);
    await expect(dimmed).toHaveAttribute('vector-effect', 'non-scaling-stroke');
  },
};

/** Zoomed in: a node that gets focus off the canvas is brought into view, so focus is never hidden. */
export const ZoomedIn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelectorAll('.vue-flow__edge')).toHaveLength(DEMO_TRAFFIC.flows.length));
    for (let step = 0; step < 10; step += 1) {
      await userEvent.click(canvas.getByRole('button', { name: t('traffic.zoomIn') }));
    }
    const pane = canvas.getByRole('region', { name: t('traffic.canvas') });
    const node = nodeOf(canvasElement, 'client:public');

    node.focus();

    await waitFor(() => {
      const inner = node.getBoundingClientRect();
      const outer = pane.getBoundingClientRect();
      void expect(inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top
        && inner.bottom <= outer.bottom).toBe(true);
    }, { timeout: 2000 });
    // Brought into view by panning the graph: a browser scroll of the clipped canvas would shift it under the pointer.
    const flow = canvasElement.querySelector<HTMLElement>('.vue-flow');
    await waitFor(() => expect([flow?.scrollLeft, flow?.scrollTop]).toEqual([0, 0]), { timeout: 2000 });
  },
};

/** No layout yet: a skeleton and a status message. */
export const Loading: Story = {
  loaders: [],
  args: { layout: null },
  render: (args) => ({
    components: { TrafficGraph },
    setup: () => ({ args }),
    template: '<div style="height: 640px"><TrafficGraph v-bind="args" /></div>',
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(t('traffic.loading'));
  },
};

export const Empty: Story = {
  args: { traffic: EMPTY, layout: { nodes: [], edges: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(t('traffic.empty'))).toBeVisible();
    await expect(canvas.getByText(t('traffic.emptyHint'))).toBeVisible();
  },
};

/** The layout failed: a message and a button to try again. */
export const LayoutError: Story = {
  loaders: [],
  args: { layout: null, error: new Error('Worker crashed') },
  render: (args) => ({
    components: { TrafficGraph },
    setup: () => ({ args }),
    template: '<div style="height: 640px"><TrafficGraph v-bind="args" /></div>',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('alert')).toHaveTextContent(t('traffic.layoutError'));
    await userEvent.click(canvas.getByRole('button', { name: t('common.retry') }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
