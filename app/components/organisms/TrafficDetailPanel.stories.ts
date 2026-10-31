import { expect, fn, userEvent, within } from 'storybook/test';

import TrafficDetailPanel from './TrafficDetailPanel.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { DEMO_IDS, DEMO_TRAFFIC } from '../../../tests/support/demo-traffic';

import type { Traffic } from '../../../shared/contracts/traffic';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { hosts, services, listeners, flows } = DEMO_IDS;

const meta = {
  title: 'Organisms/TrafficDetailPanel',
  component: TrafficDetailPanel,
  args: {
    traffic: DEMO_TRAFFIC,
    selection: { type: 'service', id: services.npm },
    onSelect: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof TrafficDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

const panel = (canvasElement: HTMLElement) => within(within(canvasElement).getByRole('complementary'));

/** A host: its kind and its services. */
export const Host: Story = {
  args: { selection: { type: 'host', id: hosts.server } },
  play: async ({ canvasElement, args }) => {
    const details = panel(canvasElement);

    await expect(details.getByRole('heading', { level: 2, name: 'Home server' })).toBeVisible();
    await expect(details.getByText('physical')).toBeVisible();
    await expect(details.getByRole('heading', { name: t('detail.services') })).toBeVisible();
    await userEvent.click(details.getByRole('button', { name: 'Website database' }));
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'service', id: services.database });
  },
};

/** A service: its host, its ports, its incoming and outgoing flows; Close emits close. */
export const Service: Story = {
  play: async ({ canvasElement, args }) => {
    const details = panel(canvasElement);

    await expect(details.getByRole('heading', { level: 2, name: 'Nginx Proxy Manager' })).toBeVisible();
    await expect(details.getByRole('button', { name: 'Home server' })).toBeVisible();
    for (const port of ['80/tcp', '81/tcp', '443/tcp']) {
      await expect(details.getAllByRole('button', { name: new RegExp(port) }).length).toBeGreaterThan(0);
    }
    await expect(details.getByRole('heading', { name: t('detail.incoming') })).toBeVisible();
    await expect(details.getAllByText(t('traffic.client.public')).length).toBeGreaterThan(0);
    await expect(details.getByRole('heading', { name: t('detail.outgoing') })).toBeVisible();
    await userEvent.click(details.getByRole('button', { name: 'Website' }));
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'service', id: services.website });
    await userEvent.click(details.getByRole('button', { name: t('detail.close') }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

/** A port: its transport, protocol and published port, and the flows ending on it. */
export const Port: Story = {
  args: { selection: { type: 'listener', id: listeners.npmHttps } },
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);

    await expect(details.getByRole('heading', { level: 2 })).toHaveTextContent('443/tcp');
    await expect(details.getByText('https')).toBeVisible();
    await expect(details.getByText(t('detail.publishedPort'))).toBeVisible();
    await expect(details.getAllByText(t('traffic.client.public')).length).toBeGreaterThan(0);
    await expect(details.getAllByText(t('traffic.client.internal')).length).toBeGreaterThan(0);
  },
};

/** A manual flow: from, to, origin, purpose and encryption written out. */
export const Flow: Story = {
  args: { selection: { type: 'flow', id: flows.weatherApi } },
  play: async ({ canvasElement, args }) => {
    const details = panel(canvasElement);

    await expect(details.getByRole('button', { name: 'Website' })).toBeVisible();
    await expect(details.getByRole('button', { name: /Weather API/ })).toBeVisible();
    await expect(details.getByText(t('traffic.origin.manual'))).toBeVisible();
    await expect(details.getByText('Fetches the forecasts')).toBeVisible();
    await expect(details.getByText(t('detail.yes'))).toBeVisible();
    await userEvent.click(details.getByRole('button', { name: 'Website' }));
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'service', id: services.website });
  },
};

/** A derived flow whose names were cut says how many more it serves. */
export const FlowWithMoreNames: Story = {
  args: {
    selection: { type: 'flow', id: flows.publicHttps },
    traffic: {
      ...DEMO_TRAFFIC,
      flows: DEMO_TRAFFIC.flows.map((flow) => (flow.id === flows.publicHttps ? { ...flow, hostnameCount: 15 } : flow)),
    } satisfies Traffic,
  },
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);

    await expect(details.getByText('www.homelab.example')).toBeVisible();
    await expect(details.getByText(t('detail.moreNames', { count: 12 }))).toBeVisible();
    await expect(details.getByText(t('traffic.origin.derived', { extension: 'nat', deriver: 'port-forwards' })))
      .toBeVisible();
  },
};

/** A client: the flows that start from it. */
export const Client: Story = {
  args: { selection: { type: 'client', id: 'public' } },
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);

    await expect(details.getByRole('heading', { level: 2, name: t('traffic.client.public') })).toBeVisible();
    await expect(details.getAllByRole('button', { name: /Nginx Proxy Manager/ })).toHaveLength(2);
  },
};
