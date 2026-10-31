import { expect, fn, userEvent, within } from 'storybook/test';

import TrafficList from './TrafficList.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { DEMO_IDS, DEMO_TRAFFIC } from '../../../tests/support/demo-traffic';

import type { Traffic } from '../../../shared/contracts/traffic';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Organisms/TrafficList',
  component: TrafficList,
  args: { traffic: DEMO_TRAFFIC, selection: null, onSelect: fn() },
} satisfies Meta<typeof TrafficList>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const { hosts, services, listeners } = DEMO_IDS;

/** The table of a host, by its caption. */
const tableOf = (canvasElement: HTMLElement, caption: string) => within(canvasElement).getByRole('table', { name: caption });

/** One table per host, then the external services; each port lists its incoming flows. */
export const Demo: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const server = tableOf(canvasElement, 'Home server');

    await expect(canvas.getAllByRole('table').map((table) => table.querySelector('caption')?.textContent.trim()))
      .toEqual(['Edge router', 'Home server', t('traffic.external')]);
    await expect(within(server).getAllByRole('columnheader').map(({ textContent }) => textContent.trim()))
      .toEqual([t('traffic.table.port'), t('traffic.table.from'), t('traffic.table.names'), t('traffic.table.how')]);
    await expect(within(tableOf(canvasElement, 'Edge router')).getByText(t('traffic.table.noService'))).toBeVisible();
    // NPM's port 80: from the local network (DNS) and from the Internet (port forward).
    const http = within(server).getAllByRole('row').filter((row) => row.textContent.includes('80/tcp'));
    await expect(http).toHaveLength(2);
    await expect(within(server).getAllByText('npm.homelab.example').length).toBeGreaterThan(0);
    await expect(within(server).getByText('Stores the site content')).toBeVisible();
    await expect(within(tableOf(canvasElement, t('traffic.external'))).getByRole('button', { name: 'Weather API' }))
      .toBeVisible();

    await userEvent.click(within(server).getByRole('button', { name: 'Nginx Proxy Manager' }));
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'service', id: services.npm });
    within(server).getByRole('button', { name: 'Home server' }).focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'host', id: hosts.server });
  },
};

/** The selected service's button says so. */
export const Selected: Story = {
  args: { selection: { type: 'service', id: services.npm } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Nginx Proxy Manager' }))
      .toHaveAttribute('aria-current', 'true');
  },
};

const NAMES = Array.from({ length: 12 }, (_, n) => `site-${String(n).padStart(2, '0')}.homelab.example`);

/** A flow with more than 10 names shows 10 and how many more; a port without flows says so. */
export const ManyNames: Story = {
  args: {
    traffic: {
      ...DEMO_TRAFFIC,
      listeners: [
        ...DEMO_TRAFFIC.listeners,
        { id: '0199d6a0-0000-7000-8000-000000000099', serviceId: services.website, port: 9100, transport: 'tcp', protocol: null, publishedPort: null },
      ],
      flows: DEMO_TRAFFIC.flows.map((flow) => (flow.targetListenerId === listeners.website
        ? { ...flow, hostnames: NAMES.slice(0, 10), hostnameCount: NAMES.length }
        : flow)),
    } satisfies Traffic,
  },
  play: async ({ canvasElement }) => {
    const server = tableOf(canvasElement, 'Home server');

    await expect(within(server).getByText('site-09.homelab.example')).toBeVisible();
    await expect(within(server).queryByText('site-10.homelab.example')).toBeNull();
    await expect(within(server).getByText(t('traffic.more', { count: 2 }))).toBeVisible();
    const unused = within(server).getAllByRole('row').find((row) => row.textContent.includes('9100/tcp'));
    await expect(unused).toHaveTextContent(t('traffic.table.noFlow'));
  },
};
