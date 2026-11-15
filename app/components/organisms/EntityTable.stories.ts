import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ref } from 'vue';

import EntityTable from './EntityTable.vue';
import { HOST_COLUMNS, HOSTS, IDS, manyHosts, optionTexts, pick, PORT_FORWARDS, REFERENCES, SITES } from '../../../.storybook/inventory';
import { i18n } from '../../../.storybook/nuxt-shims';
import natInventory from '../../../extensions/nat/app/inventory';
import { cellText } from '../../utils/inventory-cells';
import { DEFAULT_INVENTORY_QUERY } from '../../utils/inventory-query';

import type { InventoryQuery } from '../../utils/inventory-query';
import type { EntityRow } from '../../utils/inventory-rows';
import type { InventoryColumn } from '@stackmap/extension-sdk';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;
const kind = (id: string) => t(`extensions.core.kinds.host.${id}`);
const TYPE = () => t('extensions.core.entities.host');
const PLURAL = () => t('extensions.core.entitiesPlural.host');
// Testing Library normalizes the page's whitespace, French non-breaking spaces included, not the expected text.
const text = (value: string) => value.replace(/\s+/g, ' ');

const display = (entity: EntityRow, { field, format }: InventoryColumn): string => {
  const value = entity[field];
  if (format === 'reference') {
    return value ? REFERENCES['core/site']?.find(({ id }) => id === value)?.label ?? t('inventory.unknown') : '';
  }
  if (format === 'kind') {
    return kind(String(value));
  }
  if (field === 'addresses') {
    return (value as { address: string }[]).map(({ address }) => address).join(', ');
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

const meta = {
  title: 'Organisms/EntityTable',
  component: EntityTable,
  args: {
    // i18n keys, translated when the story renders: in its locale, not the one the file loaded in.
    typeLabel: 'extensions.core.entities.host',
    pluralLabel: 'extensions.core.entitiesPlural.host',
    columns: HOST_COLUMNS,
    entities: HOSTS,
    total: HOSTS.length,
    error: false,
    query: DEFAULT_INVENTORY_QUERY,
    display,
    kindField: 'kind',
    kindEntity: 'host',
    canEdit: true,
    notice: '',
    onCreate: fn(),
    onOpen: fn(),
    onEdit: fn(),
    onRemove: fn(),
    onRetry: fn(),
    'onUpdate:query': fn(),
  },
  // Held, as the page holds the query in the URL.
  render: (args) => ({
    components: { EntityTable },
    setup: () => {
      const query = ref(args.query as InventoryQuery);
      const update = (next: InventoryQuery) => {
        query.value = next;
        (args['onUpdate:query'] as (value: InventoryQuery) => void)(next);
      };
      const translated = {
        ...args,
        typeLabel: t(args.typeLabel),
        pluralLabel: t(args.pluralLabel),
        notice: args.notice ? t(args.notice, { name: 'nas' }) : '',
      };
      return { args: translated, query, update };
    },
    template: '<EntityTable v-bind="args" :query="query" @update:query="update" />',
  }),
} satisfies Meta<typeof EntityTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const table = (canvasElement: HTMLElement) => within(canvasElement).getByRole('table', { name: new RegExp(PLURAL()) });
const bodyRows = (canvasElement: HTMLElement) => within(table(canvasElement)).getAllByRole('row').slice(1);
const firstCells = (canvasElement: HTMLElement) => bodyRows(canvasElement).map((row) => within(row).getAllByRole('cell')[0]?.textContent.trim());
const search = (canvasElement: HTMLElement) => within(canvasElement).getByRole('searchbox', { name: t('inventory.search') });

/** A row per entity: the type's columns and Last updated, by the first column; references by name (7, 14). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const grid = within(table(canvasElement));

    await expect(table(canvasElement).querySelector('caption')).toHaveTextContent(PLURAL());
    await expect(grid.getAllByRole('columnheader').map(({ textContent }) => textContent.trim())).toEqual([
      ...HOST_COLUMNS.map(({ label }) => t(label)), t('inventory.lastUpdated'), t('inventory.actions'),
    ]);
    await expect(firstCells(canvasElement)).toEqual(['Edge router', 'nas']);
    await expect(bodyRows(canvasElement)[1]).toHaveTextContent(kind('physical'));
    await expect(bodyRows(canvasElement)[1]).toHaveTextContent('Home');
    await expect(grid.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'ascending');
    // Headers are named by their column, which screen readers repeat on each cell; aria-sort says the order (review).
    await expect(grid.getAllByRole('columnheader')[1]).toHaveAccessibleName(t('extensions.core.fields.host.kind'));
    await expect(grid.getByRole('button', { name: t('extensions.core.fields.host.kind') })).toBeVisible();
  },
};

/** A header's sort button sorts ascending, then descending, said with aria-sort; the URL keeps it (8, 11). */
export const Sorting: Story = {
  play: async ({ canvasElement, args }) => {
    const grid = within(table(canvasElement));
    const byKind = grid.getByRole('button', { name: t('extensions.core.fields.host.kind') });

    await userEvent.click(byKind);
    await expect(args['onUpdate:query']).toHaveBeenLastCalledWith({ ...DEFAULT_INVENTORY_QUERY, sort: 'kind', dir: 'asc' });
    await expect(grid.getAllByRole('columnheader')[1]).toHaveAttribute('aria-sort', 'ascending');
    await expect(grid.getAllByRole('columnheader')[0]).not.toHaveAttribute('aria-sort');
    await userEvent.click(byKind);
    await expect(grid.getAllByRole('columnheader')[1]).toHaveAttribute('aria-sort', 'descending');
    await expect(firstCells(canvasElement)).toEqual(i18n.global.locale.value === 'fr' ? ['nas', 'Edge router'] : ['Edge router', 'nas']);
  },
};

/** Searching narrows the rows, matching tags too, and the count is announced politely (9). */
export const Search: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(search(canvasElement), 'storage');

    await waitFor(() => expect(firstCells(canvasElement)).toEqual(['nas']));
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(t('inventory.results', { count: 1 }, 1));
    await expect(args['onUpdate:query']).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'storage', page: 1 }));
  },
};

/** The status and kind filters narrow the rows (10). */
export const Filters: Story = {
  args: { entities: [...HOSTS, { ...HOSTS[0], id: IDS.office, name: 'old-nas', status: 'deprecated' } as EntityRow] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const kindFilter = canvas.getByRole('combobox', { name: t('inventory.filterKind') });
    await expect(await optionTexts(kindFilter)).toEqual([t('inventory.all'), kind('physical'), kind('vm'), kind('vps'), kind('router')]);
    await pick(kindFilter, kind('physical'));
    await waitFor(() => expect(firstCells(canvasElement)).toEqual(['nas', 'old-nas']));

    await pick(canvas.getByRole('combobox', { name: t('inventory.filterStatus') }), t('inventory.status.deprecated'));
    await waitFor(() => expect(firstCells(canvasElement)).toEqual(['old-nas']));
  },
};

/** More than 50 rows page 50 at a time, with a labelled pagination (12). */
export const Paged: Story = {
  args: { entities: manyHosts(120), total: 120 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(bodyRows(canvasElement)).toHaveLength(50);
    const pages = within(canvas.getByRole('navigation', { name: t('inventory.pagination') }));
    // Nuxt UI names its page buttons in its own locale ("Page 2"), which the app sets.
    await userEvent.click(pages.getByRole('button', { name: /\D2$/ }));
    await expect(args['onUpdate:query']).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    await waitFor(() => expect(firstCells(canvasElement)[0]).toBe('host-0051'));
  },
};

/** Over 1000 entities: the first 1000 shown, said so (13). */
export const Truncated: Story = {
  args: { entities: manyHosts(1000), total: 1234 },
  play: async ({ canvasElement }) => {
    // Counts in the locale's format: 1,234 / 1 234 (review).
    const number = (value: number) => new Intl.NumberFormat(i18n.global.locale.value).format(value);
    await expect(within(canvasElement).getByText(text(t('inventory.truncated', { shown: number(1000), total: number(1234) }))))
      .toBeVisible();
  },
};

/** No entity yet: said, with New for editors (15). */
export const Empty: Story = {
  args: { entities: [], total: 0 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text(t('inventory.empty', { type: PLURAL() })))).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
    const buttons = canvas.getAllByRole('button', { name: t('inventory.new', { type: TYPE() }) });
    await userEvent.click(buttons[buttons.length - 1] ?? canvasElement);
    await expect(args.onCreate).toHaveBeenCalled();
  },
};

/** No entity yet, for a viewer: said, with nothing to press (15, 18). */
export const EmptyViewer: Story = {
  args: { entities: [], total: 0, canEdit: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text(t('inventory.empty', { type: PLURAL() })))).toBeVisible();
    await expect(canvas.queryByRole('button', { name: t('inventory.new', { type: TYPE() }) })).toBeNull();
  },
};

/** A search that matches nothing: said, with Clear search and filters, which empties them (16). */
export const NoMatch: Story = {
  args: { query: { ...DEFAULT_INVENTORY_QUERY, q: 'zzz', status: ['planned'] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(t('inventory.noMatch'))).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: t('inventory.clear') }));
    await expect(args['onUpdate:query']).toHaveBeenLastCalledWith(DEFAULT_INVENTORY_QUERY);
    await expect(search(canvasElement)).toHaveValue('');
    // Clear goes away: the focus goes to the search, not nowhere (review).
    await waitFor(() => expect(search(canvasElement)).toHaveFocus());
  },
};

/** The list failed: said, with Retry (17). */
export const LoadError: Story = {
  args: { entities: null, error: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(t('inventory.loadFailed'));
    await userEvent.click(canvas.getByRole('button', { name: t('inventory.retry') }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};

/** Loading: said to screen readers, with a skeleton (UI states). */
export const Loading: Story = {
  args: { entities: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text(t('inventory.loading', { type: PLURAL() })))).toBeInTheDocument();
    await expect(within(canvasElement).queryByRole('table')).toBeNull();
  },
};

/** Editors: New in the toolbar, Edit and Delete on each row, named with the entity (19). */
export const Editor: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('inventory.new', { type: TYPE() }) }));
    await expect(args.onCreate).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: t('inventory.edit', { name: 'nas' }) }));
    await expect(args.onEdit).toHaveBeenCalledWith(HOSTS[0]);
    await userEvent.click(canvas.getByRole('button', { name: t('inventory.delete', { name: 'nas' }) }));
    await expect(args.onRemove).toHaveBeenCalledWith(HOSTS[0]);
  },
};

/** Viewers: no New, Edit or Delete; a row opens read-only (18). */
export const Viewer: Story = {
  args: { canEdit: false },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: t('inventory.new', { type: TYPE() }) })).toBeNull();
    await expect(canvas.queryByRole('button', { name: t('inventory.edit', { name: 'nas' }) })).toBeNull();
    await expect(canvas.queryByRole('button', { name: t('inventory.delete', { name: 'nas' }) })).toBeNull();
    // Named with what it does, not the entity alone (review).
    await expect(t('inventory.view', { name: 'nas' })).not.toBe('nas');
    await userEvent.click(canvas.getByRole('button', { name: t('inventory.view', { name: 'nas' }) }));
    await expect(args.onOpen).toHaveBeenCalledWith(HOSTS[0]);
  },
};

/** A reference to an entity not found shows as Unknown (14). */
export const UnknownReference: Story = {
  args: { entities: [{ ...HOSTS[0], siteId: '0199d6a0-0000-7000-8000-999999999999' } as EntityRow] },
  play: async ({ canvasElement }) => {
    await expect(bodyRows(canvasElement)[0]).toHaveTextContent(t('inventory.unknown'));
  },
};

/** An outcome is announced politely: "nas saved" (24). */
export const Notice: Story = {
  args: { notice: 'inventory.saved' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(text(t('inventory.saved', { name: 'nas' })));
    // Said once: a search afterwards announces its results, not the outcome again (review).
    await userEvent.type(search(canvasElement), 'nas');
    await waitFor(() => expect(within(canvasElement).getByRole('status'))
      .not.toHaveTextContent(text(t('inventory.saved', { name: 'nas' }))));
  },
};

/** A long value wraps, whole: no ellipsis with the rest in a title, which keyboards and touch cannot reach (review). */
export const LongValue: Story = {
  args: { entities: [{ ...HOSTS[0], name: 'a-very-long-host-name-that-goes-on-and-on-past-any-column-width.homelab.example' } as EntityRow] },
  play: async ({ canvasElement }) => {
    const cell = within(bodyRows(canvasElement)[0] ?? canvasElement).getAllByRole('cell')[0] ?? canvasElement;
    await expect(cell).toHaveTextContent('a-very-long-host-name-that-goes-on-and-on-past-any-column-width.homelab.example');
    await expect(cell).not.toHaveAttribute('title');
    await expect(getComputedStyle(cell).textOverflow).not.toBe('ellipsis');
  },
};

/** The saved row is not shown (another page, filtered out): the focus goes to New, not nowhere (review). */
export const FocusMissingRow: Story = {
  render: (args) => ({
    components: { EntityTable },
    setup: () => {
      const table = ref<{ focusRow: (id: string) => void } | null>(null);
      return {
        args: { ...args, typeLabel: t(args.typeLabel as string), pluralLabel: t(args.pluralLabel as string) },
        table,
        focusMissing: () => table.value?.focusRow('0199d6a0-0000-7000-8000-999999999999'),
      };
    },
    template: '<div><EntityTable ref="table" v-bind="args" /><button type="button" @click="focusMissing">Focus</button></div>',
  }),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Focus' }));
    await expect(within(canvasElement).getByRole('button', { name: t('inventory.new', { type: TYPE() }) })).toHaveFocus();
  },
};

/** A type without a kind field: the status filter only (10). */
export const Sites: Story = {
  args: {
    entities: SITES,
    total: SITES.length,
    columns: [{ field: 'name', label: 'extensions.core.fields.site.name' }],
    typeLabel: 'extensions.core.entities.site',
    pluralLabel: 'extensions.core.entitiesPlural.site',
    kindField: undefined,
    kindEntity: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('combobox', { name: t('inventory.filterKind') })).toBeNull();
    await expect(canvas.getByRole('combobox', { name: t('inventory.filterStatus') })).toBeVisible();
  },
};

const forwardCells = (entity: EntityRow, column: InventoryColumn): string => cellText(entity, column, {
  t: (key, params) => t(key, params ?? {}),
  locale: i18n.global.locale.value,
  name: (reference, id) => REFERENCES[reference]?.find((option) => option.id === id)?.label ?? '',
  kindLabel: (_, value) => value,
});

/** Port forwards: endpoints as <address>:<port>, sorted with the port as a number, found by their port (3, 4, 5, 6). */
export const PortForwards: Story = {
  args: {
    entities: PORT_FORWARDS,
    total: PORT_FORWARDS.length,
    columns: [...natInventory.types[0]?.columns ?? []],
    display: forwardCells,
    typeLabel: 'extensions.nat.entities.port-forward',
    pluralLabel: 'extensions.nat.entitiesPlural.port-forward',
    kindField: undefined,
    kindEntity: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = within(canvas.getByRole('table'));
    const external = () => grid.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[1]?.textContent.trim());

    await expect(grid.getAllByRole('columnheader').map(({ textContent }) => textContent.trim()).slice(0, 5)).toEqual(
      ['hostId', 'external', 'transport', 'internal', 'description'].map((field) => t(`extensions.nat.fields.port-forward.${field}`)),
    );
    await expect(grid.getAllByRole('row')[1]).toHaveTextContent('Edge router');
    await userEvent.click(grid.getByRole('button', { name: t('extensions.nat.fields.port-forward.external') }));
    await expect(external()).toEqual(['203.0.113.10:80', '203.0.113.10:443']);
    await expect(grid.getAllByRole('row')[1]).toHaveTextContent('192.0.2.10:8080');
    await userEvent.type(search(canvasElement), '443');
    await waitFor(() => expect(external()).toEqual(['203.0.113.10:443']));
  },
};
