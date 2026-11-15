import { expect, userEvent, waitFor, within } from 'storybook/test';

import RouteForm from './RouteForm.vue';
import { COMMON_DEFAULTS, fieldName, fieldOf, formArgs, formRender, save } from '../../../../../.storybook/entity-form';
import { IDS, LISTENERS, optionTexts, pick, REFERENCES, SERVICES } from '../../../../../.storybook/inventory';
import { i18n } from '../../../../../.storybook/nuxt-shims';

import type { EntityRow } from '../../../../../app/utils/inventory-rows';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Extensions/ReverseProxy/RouteForm',
  component: RouteForm,
  args: formArgs('route-form'),
  render: formRender(RouteForm),
} satisfies Meta<typeof RouteForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const label = (name: string, params: Record<string, unknown> = {}) => t(`extensions.reverse-proxy.fields.route.${name}`, params);
type Role = Parameters<typeof fieldOf>[1];
const field = (canvasElement: HTMLElement, role: Role, name: string) => fieldOf(canvasElement, role, 'route', name, 'reverse-proxy');
const toggle = (canvasElement: HTMLElement, name: string) =>
  within(canvasElement).getByRole('switch', { name: fieldName('route', name, 'reverse-proxy') });
const hostname = (canvasElement: HTMLElement, number: number) =>
  within(canvasElement).getByRole('textbox', { name: new RegExp(`^${label('hostnameNumbered', { number })}`) });
const hostnameRows = (canvasElement: HTMLElement) =>
  within(canvasElement).queryAllByRole('textbox', { name: new RegExp(`^${label('hostnameNumbered', { number: '\\d+' })}`) });
const button = (canvasElement: HTMLElement, name: string) => within(canvasElement).getByRole('button', { name });
const textMode = (canvasElement: HTMLElement) => within(canvasElement).getByRole('textbox', { name: new RegExp(`^${label('hostnamesText')}`) });

/** The fixtures' services and listeners, plus a reverse proxy and its admin port. */
const NPM = '0199d6a0-0000-7000-8000-000000000022';
const NPM_ADMIN = '0199d6a0-0000-7000-8000-000000000032';
const npm = { ...SERVICES[0], id: NPM, name: 'NPM', kind: 'reverse-proxy', image: 'jc21/nginx-proxy-manager' } as EntityRow;
const WITH_PROXY = {
  ...REFERENCES,
  'core/service': [...(REFERENCES['core/service'] ?? []), { id: NPM, label: 'NPM', entity: npm }],
  'core/listener': [
    ...(REFERENCES['core/listener'] ?? []),
    { id: NPM_ADMIN, label: 'NPM :81/tcp', entity: { ...LISTENERS[0], id: NPM_ADMIN, serviceId: NPM, port: 81 } as EntityRow },
  ],
};
const ROUTE = {
  ...LISTENERS[0],
  id: '0199d6a0-0000-7000-8000-000000000080',
  proxyServiceId: NPM,
  hostnames: ['blog.homelab.example', 'www.blog.homelab.example'],
  upstreamListenerId: IDS.blogHttp,
  forceSsl: true,
  websockets: false,
} as EntityRow;

/** A new route: one empty hostname, switches off; reverse proxies only; every listener upstream (6, 7, 10, 15, 18). */
export const Empty: Story = {
  args: { references: WITH_PROXY },
  play: async ({ canvasElement, args }) => {
    await expect(hostnameRows(canvasElement)).toHaveLength(1);
    await expect(toggle(canvasElement, 'forceSsl')).not.toBeChecked();
    await expect(toggle(canvasElement, 'websockets')).not.toBeChecked();
    await expect(await optionTexts(field(canvasElement, 'combobox', 'proxyServiceId'))).toEqual(['NPM']);
    await expect(await optionTexts(field(canvasElement, 'combobox', 'upstreamListenerId')))
      .toEqual(['Blog :3000/tcp', 'Blog database :5432/tcp', 'NPM :81/tcp']);
    await pick(field(canvasElement, 'combobox', 'proxyServiceId'), 'NPM');
    await userEvent.type(hostname(canvasElement, 1), ' blog.homelab.example ');
    await pick(field(canvasElement, 'combobox', 'upstreamListenerId'), 'Blog :3000/tcp');
    await userEvent.click(toggle(canvasElement, 'forceSsl'));
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      proxyServiceId: NPM, hostnames: ['blog.homelab.example'], upstreamListenerId: IDS.blogHttp,
      forceSsl: true, websockets: false, ...COMMON_DEFAULTS,
    });
  },
};

/** No reverse proxy in the workspace: nothing to pick, and the hint says what to do (8). */
export const NoProxy: Story = {
  play: async ({ canvasElement }) => {
    await expect(field(canvasElement, 'combobox', 'proxyServiceId')).toHaveAccessibleDescription(label('noProxy'));
  },
};

/** Add focuses the new row; Remove moves the focus to the row now in its place, then to Add (11, 12). */
export const HostnameRows: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(button(canvasElement, label('addHostname')));
    await waitFor(() => expect(hostname(canvasElement, 2)).toHaveFocus());
    await userEvent.type(hostname(canvasElement, 2), 'www.blog.homelab.example');
    await userEvent.click(button(canvasElement, label('removeHostname', { number: 1 })));
    await expect(hostnameRows(canvasElement)).toHaveLength(1);
    await expect(hostname(canvasElement, 1)).toHaveValue('www.blog.homelab.example');
    await waitFor(() => expect(button(canvasElement, label('removeHostname', { number: 1 }))).toHaveFocus());
    await userEvent.click(button(canvasElement, label('removeHostname', { number: 1 })));
    await waitFor(() => expect(button(canvasElement, label('addHostname'))).toHaveFocus());
  },
};

/** At 50 hostnames Add is gone and the limit is said instead (11). */
export const HostnameLimit: Story = {
  args: { entity: { ...ROUTE, hostnames: Array.from({ length: 50 }, (_, index) => `app${String(index)}.homelab.example`) } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: label('addHostname') })).toBeNull();
    await expect(within(canvasElement).getByText(label('hostnamesLimit'))).toBeVisible();
  },
};

/** Edit as text joins the rows; Edit one by one splits them, trimmed, without blank lines; focus follows (13–15). */
export const TextMode: Story = {
  args: { entity: ROUTE, references: WITH_PROXY },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(button(canvasElement, label('editAsText')));
    await waitFor(() => expect(textMode(canvasElement)).toHaveFocus());
    await expect(textMode(canvasElement)).toHaveValue('blog.homelab.example\nwww.blog.homelab.example');
    await expect(hostnameRows(canvasElement)).toHaveLength(0);
    await userEvent.clear(textMode(canvasElement));
    await userEvent.type(textMode(canvasElement), '  a.homelab.example {enter}{enter} b.homelab.example{enter}');
    await userEvent.click(button(canvasElement, label('editOneByOne')));
    await expect(hostnameRows(canvasElement).map((row) => (row as HTMLInputElement).value))
      .toEqual(['a.homelab.example', 'b.homelab.example']);
    await waitFor(() => expect(hostname(canvasElement, 1)).toHaveFocus());
    await userEvent.click(button(canvasElement, label('editAsText')));
    await userEvent.type(textMode(canvasElement), '{enter}c.homelab.example ');
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      hostnames: ['a.homelab.example', 'b.homelab.example', 'c.homelab.example'],
    }));
  },
};

/** A hostname's issue under its row, the list's under the group, the proxy's under the proxy (16, 17, 19). */
export const IssuesInRows: Story = {
  args: {
    entity: ROUTE,
    references: WITH_PROXY,
    issues: {
      'hostnames.1': ['www.blog.homelab.example is already served by this proxy'],
      hostnames: ['blog.homelab.example is listed twice'],
      proxyServiceId: ['NPM is not a reverse proxy'],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(hostname(canvasElement, 2)).toHaveAttribute('aria-invalid', 'true');
    await expect(hostname(canvasElement, 2)).toHaveAttribute('id', 'route-form-hostnames-1');
    await expect(hostname(canvasElement, 2)).toHaveAccessibleDescription(expect.stringContaining('already served') as string);
    await expect(hostname(canvasElement, 1)).not.toHaveAttribute('aria-invalid', 'true');
    const group = within(canvasElement).getByRole('group', { name: new RegExp(`^${label('hostnames')}`) });
    await expect(group).toHaveAccessibleDescription(expect.stringContaining('listed twice') as string);
    await expect(group).toHaveAttribute('id', 'route-form-hostnames');
    await expect(field(canvasElement, 'combobox', 'proxyServiceId')).toHaveAttribute('aria-invalid', 'true');
  },
};

/** In text mode, a hostname's issue is said with its line, linked to the textarea (16). */
export const IssuesInTextMode: Story = {
  args: { entity: ROUTE, references: WITH_PROXY, issues: { 'hostnames.1': ['www.blog.homelab.example is already served'] } },
  play: async ({ canvasElement }) => {
    await userEvent.click(button(canvasElement, label('editAsText')));
    await expect(textMode(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(textMode(canvasElement)).toHaveAccessibleDescription(expect.stringContaining(
      label('line', { number: 2, message: 'www.blog.homelab.example is already served' }),
    ) as string);
  },
};

/** Editing: the route's values; a service that is no longer a reverse proxy is said unavailable and kept (9). */
export const Editing: Story = {
  args: { entity: { ...ROUTE, proxyServiceId: IDS.blog }, references: WITH_PROXY },
  play: async ({ canvasElement, args }) => {
    await expect(field(canvasElement, 'combobox', 'proxyServiceId')).toHaveTextContent(t('inventory.unavailable', { id: 'Blog' }));
    await expect(hostname(canvasElement, 2)).toHaveValue('www.blog.homelab.example');
    await expect(toggle(canvasElement, 'forceSsl')).toBeChecked();
    await save(canvasElement);
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ proxyServiceId: IDS.blog }));
  },
};

/** Read-only for viewers: values as text, nothing to toggle, add or remove (20). */
export const ReadOnly: Story = {
  args: { entity: ROUTE, references: WITH_PROXY, readonly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(field(canvasElement, 'textbox', 'proxyServiceId')).toHaveValue('NPM');
    await expect(hostname(canvasElement, 2)).toHaveAttribute('readonly');
    await expect(field(canvasElement, 'textbox', 'forceSsl')).toHaveValue(t('inventory.yes'));
    await expect(field(canvasElement, 'textbox', 'websockets')).toHaveValue(t('inventory.no'));
    for (const name of [label('addHostname'), label('editAsText'), label('removeHostname', { number: 1 }), t('inventory.save')]) {
      await expect(canvas.queryByRole('button', { name })).toBeNull();
    }
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
  },
};
