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
const steps = (canvasElement: HTMLElement) => panel(canvasElement)
  .getByRole('navigation', { name: t('trace.walk.label') });
const position = (step: number, total = 6) => t('trace.walk.position', { position: step, total });
// The demo trace's walk: the request in order, then the dependencies.
const WALK = [
  `${flows.publicHttp}:client`, `${flows.publicHttps}:client`,
  `${flows.routeWebsite}:${listeners.npmHttp}`, `${flows.routeWebsite}:${listeners.npmHttps}`,
  `${flows.database}:${listeners.website}`, `${flows.weatherApi}:${listeners.website}`,
];
/** The panel with its selection held, as the page does. */
const held = (args: Record<string, unknown>) => ({
  components: { TraceDetailPanel },
  setup: () => ({ args, selection: ref(args.selection as TraceSelection) }),
  template: '<TraceDetailPanel :trace="args.trace" :selection="selection" @select="selection = $event" @close="args.onClose" />',
});

/** A step: from, to, role and flow, then its hops in order, each with its stage and sentence. */
export const Step: Story = {
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);
    const hops = details.getByRole('list', { name: t('trace.hops') });

    await expect(details.getByRole('heading', { level: 2 })).toHaveTextContent('Nginx Proxy Manager');
    await expect(details.getByText(t('trace.role.request'))).toBeVisible();
    await expect(details.getByText(t('traffic.origin.derived', { extension: 'nat', deriver: 'port-forwards' }))).toBeVisible();
    const lines = within(hops).getAllByRole('listitem').map(({ textContent }) => textContent.replace(/\s+/g, ' ').trim());
    // "Network: Edge router forwards…": the stage and the sentence are told apart for screen readers too.
    await expect(lines).toEqual([
      t('trace.hopWithStage', {
        stage: t('trace.stage.dns'),
        sentence: t('extensions.core.trace.address.public', { name: 'app.homelab.example', address: '203.0.113.10' }),
      }),
      t('trace.hopWithStage', {
        stage: t('trace.stage.network'),
        sentence: t('extensions.nat.trace.forward', {
          router: 'Edge router', external: '203.0.113.10:443/tcp', internal: '10.0.10.20:443',
        }),
      }),
    ].map((line) => line.replace(/\s+/g, ' ')));
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

/** "Step 2 of 6" with Previous and Next in a "Steps" navigation; Next selects step 3 and keeps the focus. (11, 12) */
export const Walk: Story = {
  render: held,
  play: async ({ canvasElement }) => {
    const nav = within(steps(canvasElement));

    await expect(nav.getByText(position(2))).toBeVisible();
    const next = nav.getByRole('button', { name: t('trace.walk.next') });
    await userEvent.click(next);

    await expect(nav.getByText(position(3))).toBeVisible();
    await expect(next).toHaveFocus();
  },
};

/** Previous disabled on the first step, Next on the last; reaching the last moves focus to Previous. (13) */
export const WalkEnds: Story = {
  args: { selection: { type: 'step', id: WALK[0] ?? '' } },
  render: held,
  play: async ({ canvasElement }) => {
    const nav = within(steps(canvasElement));
    const previous = nav.getByRole('button', { name: t('trace.walk.previous') });
    const next = nav.getByRole('button', { name: t('trace.walk.next') });

    await expect(previous).toBeDisabled();
    for (let step = 2; step <= 6; step += 1) {
      await userEvent.click(next);
      await expect(nav.getByText(position(step))).toBeVisible();
    }
    await expect(next).toBeDisabled();
    // The pressed button went disabled: focus moves to the other one rather than being lost.
    await expect(previous).toHaveFocus();
  },
};

/** A trace of one step: the position, no navigation. (14) */
export const WalkOneStep: Story = {
  args: {
    trace: { ...DEMO_TRACE, steps: DEMO_TRACE.steps.filter(({ id }) => id === WALK[0]) } satisfies Trace,
    selection: { type: 'step', id: WALK[0] ?? '' },
  },
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);

    await expect(details.getByText(position(1, 1))).toBeVisible();
    await expect(details.queryByRole('navigation')).toBeNull();
  },
};

/** A listener or the client selected: no step navigation. (15) */
export const NoWalkOnListener: Story = {
  args: { selection: { type: 'listener', id: listeners.website } },
  play: async ({ canvasElement }) => {
    await expect(panel(canvasElement).queryByRole('navigation')).toBeNull();
    await expect(panel(canvasElement).queryByText(/6/)).toBeNull();
  },
};

/** Previous and Next keep the focus; following a listener link still moves it to the title. (18) */
export const WalkKeepsFocus: Story = {
  args: { selection: { type: 'step', id: WALK[3] ?? '' } },
  render: held,
  play: async ({ canvasElement }) => {
    const details = panel(canvasElement);
    const nav = within(steps(canvasElement));

    nav.getByRole('button', { name: t('trace.walk.previous') }).focus();
    await userEvent.keyboard('{Enter}');
    await expect(nav.getByText(position(3))).toBeVisible();
    await expect(nav.getByRole('button', { name: t('trace.walk.previous') })).toHaveFocus();

    // A link to a listener still moves focus to the new title.
    details.getByRole('button', { name: /3000\/tcp/ }).focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(details.getByRole('heading', { level: 2 })).toHaveFocus());
  },
};
