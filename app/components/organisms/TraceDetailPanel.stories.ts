import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ref } from 'vue';

import TraceDetailPanel from './TraceDetailPanel.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { DEMO_TRACE } from '../../../tests/support/demo-trace';
import { DEMO_IDS } from '../../../tests/support/demo-traffic';

import type { Trace } from '../../../shared/contracts/traces';
import type { TraceSelection } from '../../utils/trace-index';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { listeners, flows } = DEMO_IDS;

const meta = {
  title: 'Organisms/TraceDetailPanel',
  component: TraceDetailPanel,
  args: { trace: DEMO_TRACE, selection: { type: 'step', id: `${flows.publicHttps}:client` }, onSelect: fn(), onClose: fn() },
} satisfies Meta<typeof TraceDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const panel = (canvasElement: HTMLElement) => within(within(canvasElement).getByRole('complementary'));

/** A step: from, to, role and flow, then its hops in order, each with its stage and sentence. */
export const Step: Story = {
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);
    const hops = details.getByRole('list', { name: t('trace.hops') });

    await expect(details.getByRole('heading', { level: 2 })).toHaveTextContent('Nginx Proxy Manager');
    await expect(details.getByText(t('trace.role.request'))).toBeVisible();
    await expect(details.getByText(t('traffic.origin.derived', { extension: 'nat', deriver: 'port-forwards' }))).toBeVisible();
    const lines = within(hops).getAllByRole('listitem').map(({ textContent }) => textContent.replace(/\s+/g, ' ').trim());
    await expect(lines).toEqual([
      `${t('trace.stage.dns')} ${t('extensions.core.trace.address.public', {
        name: 'app.homelab.example', address: '203.0.113.10',
      })}`,
      `${t('trace.stage.network')} ${t('extensions.nat.trace.forward', {
        router: 'Edge router', external: '203.0.113.10:443/tcp', internal: '10.0.10.20:443',
      })}`,
    ]);
  },
};

/** A listener: its service, host and port, and the steps in and out of it. */
export const Listener: Story = {
  args: { selection: { type: 'listener', id: listeners.website } },
  play: async ({ canvasElement, args }) => {
    const details = panel(canvasElement);

    await expect(details.getByRole('heading', { level: 2 })).toHaveTextContent('Website 3000/tcp');
    await expect(details.getByText('Home server')).toBeVisible();
    await expect(details.getAllByRole('button', { name: /Nginx Proxy Manager/ })).toHaveLength(2);
    await expect(details.getByRole('button', { name: /Website database/ })).toBeVisible();
    await userEvent.click(details.getByRole('button', { name: /Website database/ }));
    await expect(args.onSelect).toHaveBeenCalledWith({ type: 'step', id: `${flows.database}:${listeners.website}` });
  },
};

/** A hop no extension describes reads as a count, in the current language. */
export const GenericHop: Story = {
  args: {
    trace: {
      ...DEMO_TRACE,
      steps: DEMO_TRACE.steps.map((step) => (step.id === `${flows.publicHttps}:client`
        ? {
            ...step,
            hops: [{
              entity: 'firewall-rule', id: flows.database, stage: 'network', label: 'trace.hop.unknown',
              params: { entity: 'firewall-rule', count: '3' },
            }],
          }
        : step)),
    } satisfies Trace,
  },
  play: async ({ canvasElement }) => {
    await expect(panel(canvasElement).getByText(t('trace.hop.unknown', { count: 3 }, 3))).toBeVisible();
  },
};

/** Following a link inside the panel keeps focus there, on the new title; Close emits close. */
export const FollowingALink: Story = {
  render: (args) => ({
    components: { TraceDetailPanel },
    setup: () => ({ args, selection: ref(args.selection as TraceSelection) }),
    template: '<TraceDetailPanel :trace="args.trace" :selection="selection" @select="selection = $event" @close="args.onClose" />',
  }),
  play: async ({ canvasElement, args }) => {
    const details = panel(canvasElement);

    details.getByRole('button', { name: /443\/tcp/ }).focus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(details.getByRole('heading', { level: 2 })).toHaveFocus());
    await userEvent.click(details.getByRole('button', { name: t('detail.close') }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};
