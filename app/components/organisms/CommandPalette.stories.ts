import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ref } from 'vue';

import CommandPalette from './CommandPalette.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { PaletteGroup } from '../../utils/palette';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

/** Two groups of fictional results, as the app will give them. */
const GROUPS: PaletteGroup[] = [
  {
    id: 'pages',
    label: 'Pages',
    items: [
      { id: 'traffic', label: 'Traffic', icon: 'i-lucide-waypoints' },
      { id: 'trace', label: 'Trace', icon: 'i-lucide-route' },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    items: [{ id: 'sign-out', label: 'Sign out', icon: 'i-lucide-log-out' }],
  },
];

const meta = {
  title: 'Organisms/CommandPalette',
  component: CommandPalette,
  args: { open: true, groups: GROUPS, loading: false, 'onUpdate:open': fn(), onSelect: fn() },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

const dialog = () => within(document.body).getByRole('dialog', { name: t('palette.title') });
const field = () => within(dialog()).getByRole('combobox');

/** Open, it is a dialog named Search with the focus in its search field (1). */
export const Open: Story = {
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    await expect(field()).toHaveAttribute('placeholder', t('palette.placeholder'));
  },
};

/** Closed, nothing of it is in the page. */
export const Closed: Story = {
  args: { open: false },
  play: async () => {
    await expect(within(document.body).queryByRole('dialog')).toBeNull();
  },
};

/** Escape asks to close it (1). */
export const Escape: Story = {
  play: async ({ args }) => {
    await waitFor(() => expect(field()).toHaveFocus());
    await userEvent.keyboard('{Escape}');

    await expect(args['onUpdate:open']).toHaveBeenCalledWith(false);
  },
};

/** The results are a listbox whose options say their group; arrows move, Enter chooses (2). */
export const Keyboard: Story = {
  play: async ({ args }) => {
    await waitFor(() => expect(field()).toHaveFocus());
    const options = within(dialog()).getAllByRole('option');
    await expect(options).toHaveLength(3);
    await expect(options[2]).toHaveAccessibleName(t('palette.option', { label: 'Sign out', group: 'Actions' }));

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    await expect(args.onSelect).toHaveBeenCalledWith(GROUPS[0]?.items[1], GROUPS[0]);
  },
};

/** After each search, the number of results is said politely (2). */
export const ResultsCount: Story = {
  render: (args) => ({
    components: { CommandPalette },
    setup: () => ({ args, searchTerm: ref('') }),
    template: '<CommandPalette v-bind="args" v-model:search-term="searchTerm" />',
  }),
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    const status = within(dialog()).getByRole('status');
    await expect(status).toHaveTextContent(t('palette.results', { count: 3 }, 3));

    await userEvent.type(field(), 'trace');

    await waitFor(() => expect(status).toHaveTextContent(t('palette.results', { count: 1 }, 1)));
  },
};

/** With nothing matching, it says so, naming the search (2). */
export const NothingMatches: Story = {
  render: (args) => ({
    components: { CommandPalette },
    setup: () => ({ args, searchTerm: ref('') }),
    template: '<CommandPalette v-bind="args" v-model:search-term="searchTerm" />',
  }),
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    await userEvent.type(field(), 'zzz');

    await waitFor(() => expect(within(dialog()).getByText(t('palette.empty', { q: 'zzz' }))).toBeVisible());
    await expect(within(dialog()).getByRole('status')).toHaveTextContent(t('palette.results', { count: 0 }, 0));
  },
};

/** While results are fetched, it says so. */
export const Loading: Story = {
  args: { loading: true },
  play: async () => {
    await waitFor(() => expect(within(dialog()).getByRole('status')).toHaveTextContent(t('palette.searching')));
  },
};
