import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ref } from 'vue';

import TrafficDetailPanel from './TrafficDetailPanel.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { DEMO_IDS, DEMO_TRAFFIC } from '../../../tests/support/demo-traffic';

import type { Traffic } from '../../../shared/contracts/traffic';
import type { Selection } from '../../utils/traffic-selection';
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
const traceLink = (client: 'public' | 'internal', hostname: string) => t(`detail.trace.${client}`, { hostname });
const traceHref = (client: 'public' | 'internal', hostname: string) => `/trace?hostname=${hostname}&client=${client}`;
const reaching = (canvasElement: HTMLElement) => within(panel(canvasElement)
  .getByRole('region', { name: t('detail.namesReaching') }));
const linkNames = (scope: ReturnType<typeof panel>) => scope.queryAllByRole('link').map(({ textContent }) => textContent.trim());

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
  play: async ({ canvasElement, args }) => {
    const details = panel(canvasElement);

    await expect(details.getByText('www.homelab.example')).toBeVisible();
    await expect(details.getByText(t('detail.moreNames', { count: 12 }))).toBeVisible();
    await expect(details.getByText(t('traffic.origin.derived', { extension: 'nat', deriver: 'port-forwards' })))
      .toBeVisible();
    await userEvent.click(details.getByRole('button', { name: t('traffic.client.public') }));
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'client', id: 'public' });
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

/** Following a link inside the panel keeps focus there, on the new title, rather than losing it. */
export const FollowingALink: Story = {
  render: (args) => ({
    components: { TrafficDetailPanel },
    setup: () => {
      const selection = ref(args.selection as Selection);
      return { args, selection };
    },
    template: '<TrafficDetailPanel :traffic="args.traffic" :selection="selection" @select="selection = $event" />',
  }),
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);
    const port = details.getAllByRole('button', { name: /443\/tcp/ })[0];

    port?.focus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(details.getByRole('heading', { level: 2 })).toHaveFocus());
    await expect(details.getByRole('heading', { level: 2 })).toHaveTextContent('443/tcp');
  },
};

/**
 * A flow from the Internet: each name has a link "Trace <name> from the Internet" to /trace; a wildcard has none; only
 * listed names have links, "N more names" stays. (1, 4, 5)
 */
export const FlowTraceLinks: Story = {
  args: {
    selection: { type: 'flow', id: flows.publicHttps },
    traffic: {
      ...DEMO_TRAFFIC,
      flows: DEMO_TRAFFIC.flows.map((flow) => (flow.id === flows.publicHttps
        ? { ...flow, hostnames: ['*.homelab.example', 'app.homelab.example', 'homelab.example'], hostnameCount: 15 }
        : flow)),
    } satisfies Traffic,
  },
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);

    await expect(details.getByRole('link', { name: traceLink('public', 'app.homelab.example') }))
      .toHaveAttribute('href', traceHref('public', 'app.homelab.example'));
    await expect(linkNames(details)).toEqual([
      traceLink('public', 'app.homelab.example'), traceLink('public', 'homelab.example'),
    ]);
    // A wildcard cannot be traced: shown, without a link.
    await expect(details.getByText('*.homelab.example')).toBeVisible();
    await expect(details.getByText(t('detail.moreNames', { count: 12 }))).toBeVisible();
  },
};

/** A flow from the local network traces from the local network. (2) */
export const InternalFlowTraceLinks: Story = {
  args: { selection: { type: 'flow', id: flows.internalHttps } },
  play: async ({ canvasElement }) => {
    await expect(panel(canvasElement).getByRole('link', { name: traceLink('internal', 'npm.homelab.example') }))
      .toHaveAttribute('href', traceHref('internal', 'npm.homelab.example'));
  },
};

/** A flow between services that serves names traces from the Internet. (3) */
export const ServiceFlowTraceLinks: Story = {
  args: { selection: { type: 'flow', id: flows.routeWebsite } },
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);

    await expect(linkNames(details)).toEqual(['app.homelab.example', 'homelab.example', 'www.homelab.example']
      .map((hostname) => traceLink('public', hostname)));
    await expect(details.getByRole('link', { name: traceLink('public', 'homelab.example') }))
      .toHaveAttribute('href', traceHref('public', 'homelab.example'));
  },
};

/** A port lists "Names reaching it": one link per name and client, sorted, no duplicates. (6) */
export const PortNamesReaching: Story = {
  args: { selection: { type: 'listener', id: listeners.npmHttps } },
  play: async ({ canvasElement }) => {
    await expect(linkNames(reaching(canvasElement))).toEqual([
      traceLink('public', 'app.homelab.example'),
      traceLink('public', 'homelab.example'),
      traceLink('internal', 'npm.homelab.example'),
      traceLink('public', 'www.homelab.example'),
    ]);
    // Standalone links: in strict mode they get the 44 px targets buttons have.
    if (document.documentElement.getAttribute('data-contrast') === 'strict') {
      for (const link of reaching(canvasElement).getAllByRole('link')) {
        await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      }
    }
  },
};

/** A port many names reach: the first 20 links, then how many more. */
export const ManyNamesReaching: Story = {
  args: {
    selection: { type: 'listener', id: listeners.website },
    traffic: {
      ...DEMO_TRAFFIC,
      flows: [...DEMO_TRAFFIC.flows, ...[0, 1, 2].map((batch) => {
        const hostnames = Array.from({ length: 10 }, (_, item) => `n${String(batch * 10 + item).padStart(2, '0')}.homelab.example`);
        return { ...DEMO_TRAFFIC.flows.find(({ id }) => id === flows.routeWebsite)!, id: `many-${String(batch)}`, hostnames, hostnameCount: 10 };
      })],
    } satisfies Traffic,
  },
  play: async ({ canvasElement }) => {
    const names = reaching(canvasElement);

    // 33 names reach the website: its own 3 and the 30 added.
    await expect(names.getAllByRole('link')).toHaveLength(20);
    await expect(names.getByText(t('detail.moreNames', { count: 13 }))).toBeVisible();
  },
};

/** Two panels on one page (the docs page): each section keeps its own name. */
export const TwoPanels: Story = {
  render: (args) => ({
    components: { TrafficDetailPanel },
    setup: () => ({ args }),
    template: '<div><TrafficDetailPanel :traffic="args.traffic" :selection="args.selection" />'
      + `<TrafficDetailPanel :traffic="args.traffic" :selection="{ type: 'host', id: '${hosts.server}' }" /></div>`,
  }),
  play: async ({ canvasElement }) => {
    const ids = [...canvasElement.querySelectorAll('[id]')].map(({ id }) => id);

    await expect(new Set(ids).size).toBe(ids.length);
    // Each panel is named by its own title, not the first one's.
    await expect(within(canvasElement).getByRole('complementary', { name: 'Nginx Proxy Manager' })).toBeVisible();
    await expect(within(canvasElement).getByRole('complementary', { name: 'Home server' })).toBeVisible();
  },
};

/** A service lists the names of the flows into any of its ports. (7) */
export const ServiceNamesReaching: Story = {
  play: async ({ canvasElement }) => {
    await expect(linkNames(reaching(canvasElement))).toEqual([
      traceLink('public', 'app.homelab.example'),
      traceLink('public', 'homelab.example'),
      traceLink('public', 'npm.homelab.example'),
      traceLink('internal', 'npm.homelab.example'),
      traceLink('public', 'www.homelab.example'),
    ]);
  },
};

/** A port or service no named flow reaches says "None". (8) */
export const NoNamesReaching: Story = {
  args: { selection: { type: 'service', id: services.database } },
  play: async ({ canvasElement }) => {
    const names = reaching(canvasElement);

    await expect(names.getByText(t('detail.none'))).toBeVisible();
    await expect(names.queryAllByRole('link')).toEqual([]);
  },
};
