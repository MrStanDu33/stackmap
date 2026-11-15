/*
 * A small fictional stack for the inventory stories: entities as the entity API sends them, and the reference options
 * the inventory page gives forms. Documentation addresses and `.example` names only.
 */
import type { EntityRow } from '../app/utils/inventory-rows';
import type { InventoryColumn } from '@stackmap/extension-sdk';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

export const IDS = {
  home: id(1), office: id(2),
  lan: id(6),
  nas: id(10), router: id(11),
  blog: id(20), database: id(21),
  blogHttp: id(30), databasePort: id(31),
  domain: id(40),
  record: id(50),
  flow: id(60),
} as const;

const common = (n: number) => ({
  status: 'active',
  tags: [] as string[],
  notes: '',
  links: [] as { label: string; url: string }[],
  customFields: {},
  origin: 'manual',
  externalRef: null as string | null,
  createdBy: null,
  updatedBy: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: `2026-11-${String(2 + (n % 20)).padStart(2, '0')}T10:00:00.000Z`,
});

export const SITES: EntityRow[] = [
  { id: IDS.home, name: 'Home', ...common(1) },
  { id: IDS.office, name: 'Office', ...common(2), status: 'planned' },
];

export const NETWORKS: EntityRow[] = [
  { id: IDS.lan, name: 'LAN', kind: 'lan', cidr: '192.0.2.0/24', vlan: 10, siteId: IDS.home, ...common(6) },
];

export const HOSTS: EntityRow[] = [
  {
    id: IDS.nas, name: 'nas', kind: 'physical', os: 'Debian 13', siteId: IDS.home,
    addresses: [{ address: '192.0.2.10', networkId: IDS.lan }], ...common(10), tags: ['storage'],
  },
  {
    id: IDS.router, name: 'Edge router', kind: 'router', os: null, siteId: null,
    addresses: [{ address: '192.0.2.1', networkId: IDS.lan }], ...common(11),
  },
];

export const SERVICES: EntityRow[] = [
  { id: IDS.blog, name: 'Blog', kind: 'app', hostId: IDS.nas, image: 'ghcr.io/example/blog:1.4', containerName: 'blog', ...common(20) },
  { id: IDS.database, name: 'Blog database', kind: 'database', hostId: IDS.nas, image: null, containerName: null, ...common(21) },
];

export const LISTENERS: EntityRow[] = [
  { id: IDS.blogHttp, serviceId: IDS.blog, port: 3000, transport: 'tcp', protocol: 'http', bindAddress: '0.0.0.0', publishedPort: 8080, ...common(30) },
  { id: IDS.databasePort, serviceId: IDS.database, port: 5432, transport: 'tcp', protocol: null, bindAddress: '0.0.0.0', publishedPort: null, ...common(31) },
];

export const DOMAINS: EntityRow[] = [{ id: IDS.domain, name: 'homelab.example', ...common(40) }];

export const DNS_RECORDS: EntityRow[] = [
  { id: IDS.record, domainId: IDS.domain, name: 'blog', type: 'A', value: '203.0.113.10', view: 'public', proxied: false, ...common(50) },
];

export const FLOWS: EntityRow[] = [
  { id: IDS.flow, sourceServiceId: IDS.blog, targetListenerId: IDS.databasePort, protocol: null, purpose: 'Stores the posts', encrypted: false, ...common(60) },
];

/** What the inventory page gives a form for its reference selects, by referenced type. */
export const REFERENCES: Record<string, { id: string; label: string }[]> = {
  'core/site': SITES.map(({ id: value, name }) => ({ id: value, label: String(name) })),
  'core/network': NETWORKS.map(({ id: value, name }) => ({ id: value, label: String(name) })),
  'core/host': HOSTS.map(({ id: value, name }) => ({ id: value, label: String(name) })),
  'core/service': SERVICES.map(({ id: value, name }) => ({ id: value, label: String(name) })),
  'core/listener': [
    { id: IDS.blogHttp, label: 'Blog :3000/tcp' },
    { id: IDS.databasePort, label: 'Blog database :5432/tcp' },
  ],
  'core/domain': DOMAINS.map(({ id: value, name }) => ({ id: value, label: String(name) })),
};

/** The host table's columns, as the core registers them. */
export const HOST_COLUMNS: InventoryColumn[] = [
  { field: 'name', label: 'extensions.core.fields.host.name' },
  { field: 'kind', label: 'extensions.core.fields.host.kind', format: 'kind' },
  { field: 'siteId', label: 'extensions.core.fields.host.siteId', format: 'reference', reference: 'core/site' },
  { field: 'addresses', label: 'extensions.core.fields.host.addresses', format: 'list' },
];

/** Many hosts, for paging and the 1000-row cap. */
export const manyHosts = (count: number): EntityRow[] => Array.from({ length: count }, (_, index) => ({
  ...HOSTS[0],
  id: id(1000 + index),
  name: `host-${String(index + 1).padStart(4, '0')}`,
  addresses: [],
} as EntityRow));

/** The open list's options: Nuxt UI renders them in a portal, outside the story's canvas. */
export const optionsOf = async (combobox: HTMLElement): Promise<HTMLElement[]> => {
  const { userEvent, waitFor } = await import('storybook/test');
  await userEvent.click(combobox);
  return waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
    if (found.length === 0) {
      throw new Error('No options.');
    }
    return found;
  });
};

/** Picks an option by its text, as a user would, and waits for the list to close. */
export const pick = async (combobox: HTMLElement, text: string): Promise<void> => {
  const { expect, userEvent, waitFor } = await import('storybook/test');
  const option = (await optionsOf(combobox)).find((element) => element.textContent.trim() === text);
  await expect(option, `option "${text}"`).toBeDefined();
  await userEvent.click(option as HTMLElement);
  await waitFor(() => expect(document.querySelector('[role="listbox"]')).toBeNull());
};

/** The options' texts, then closes the list again: an open list hides the page from assistive technologies. */
export const optionTexts = async (combobox: HTMLElement): Promise<string[]> => {
  const { expect, userEvent, waitFor } = await import('storybook/test');
  const texts = (await optionsOf(combobox)).map((element) => element.textContent.trim());
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.querySelector('[role="listbox"]')).toBeNull());
  return texts;
};
