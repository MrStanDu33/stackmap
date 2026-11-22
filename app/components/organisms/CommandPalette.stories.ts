import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
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
const field = () => within(dialog()).getByRole('combobox', { name: t('palette.title') });
const list = () => within(dialog()).getByRole('listbox', { name: t('palette.resultsLabel') });
const strict = () => document.documentElement.getAttribute('data-contrast') === 'strict';
/** Whether an element shows an outline or a ring, beyond its background color. */
const outlined = (element: Element) => {
  const style = getComputedStyle(element);
  return (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none';
};

/**
 * Open, it is a dialog named Search with the focus in its search field, which shows it has the focus; nothing is said
 * until something is typed (1, review).
 */
export const Open: Story = {
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    await expect(field()).toHaveAttribute('placeholder', t('palette.placeholder'));
    await expect(outlined(field())).toBe(true);
    await expect(within(dialog()).getByRole('status')).toHaveTextContent('');
  },
};

/** Tab never reaches a control nobody can see: the dialog has no hidden close button (review). */
export const NoHiddenControl: Story = {
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    await expect(within(dialog()).queryAllByRole('button')).toEqual([]);
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

/**
 * The results are a listbox named Results whose options say their group; the first is active, shown by more than a
 * color, arrows move it (wrapping around), Enter chooses (2, review).
 */
export const Keyboard: Story = {
  play: async ({ args }) => {
    await waitFor(() => expect(field()).toHaveFocus());
    const options = within(list()).getAllByRole('option');
    await expect(options).toHaveLength(3);
    // Its label then its group; the hidden group text is laid out apart, so a space may come before its comma.
    const group = t('palette.inGroup', { group: 'Actions' }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(options[2]).toHaveAccessibleName(new RegExp(`^Sign out ?${group}$`));
    await expect(field()).toHaveAttribute('aria-activedescendant', options[0]?.id);
    await expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await expect(outlined(options[0] as Element)).toBe(true);
    await expect(outlined(options[1] as Element)).toBe(false);

    await userEvent.keyboard('{ArrowUp}');
    await expect(field()).toHaveAttribute('aria-activedescendant', options[2]?.id);
    await userEvent.keyboard('{ArrowDown}');

    // From the first result: Enter right after typing chooses the best match.
    await userEvent.keyboard('{ArrowDown}{Enter}');

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
    await expect(status).toHaveTextContent('');

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

    // Matched raw: getByText turns the French no-break spaces into plain ones.
    await waitFor(() => expect(within(dialog()).getByText((_, element) => element?.textContent.trim() === t('palette.empty', { q: 'zzz' })))
      .toBeVisible());
    await waitFor(() => expect(within(dialog()).getByRole('status')).toHaveTextContent(t('palette.results', { count: 0 }, 0)));
    // No empty listbox: the field says there is nothing to show (review).
    await expect(within(dialog()).queryByRole('listbox')).toBeNull();
    await expect(field()).toHaveAttribute('aria-expanded', 'false');
  },
};

/** With no group at all, there is no listbox either (review). */
export const NoGroups: Story = {
  args: { groups: [] },
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    await expect(within(dialog()).queryByRole('listbox')).toBeNull();
    await expect(field()).toHaveAttribute('aria-expanded', 'false');
  },
};

/** An option's description, such as an entity's type, is read with it (review). */
export const Described: Story = {
  args: {
    groups: [{ id: 'entities', label: 'Entities', items: [{ id: 'router', label: 'Edge router', description: 'Host' }] }],
  },
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    await expect(within(list()).getByRole('option')).toHaveAccessibleDescription('Host');
  },
};

/** In strict contrast, options are 44 px targets (review). */
export const StrictTargets: Story = {
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    if (strict()) {
      for (const option of within(list()).getAllByRole('option')) {
        await expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      }
    }
  },
};

/** While an input method composes text (Chinese, Japanese…), arrows and Enter are its own (review). */
export const Composing: Story = {
  play: async ({ args }) => {
    await waitFor(() => expect(field()).toHaveFocus());
    const first = within(list()).getAllByRole('option')[0]?.id;

    await fireEvent.keyDown(field(), { key: 'ArrowDown', isComposing: true });
    await fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });

    await expect(field()).toHaveAttribute('aria-activedescendant', first);
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

/** While results are fetched, it says so, and its icon spins unless motion is reduced (review). */
export const Loading: Story = {
  args: { loading: true },
  play: async () => {
    await waitFor(() => expect(within(dialog()).getByRole('status')).toHaveTextContent(t('palette.searching')));
    const icon = dialog().querySelector('[data-slot="leadingIcon"]');
    const reduced = strict() || matchMedia('(prefers-reduced-motion: reduce)').matches;
    await expect(icon && getComputedStyle(icon).animationName !== 'none').toBe(!reduced);
  },
};

/** Each group shows its icon and color on its heading and on each result; its name says it in text too (8). */
export const GroupColors: Story = {
  args: {
    groups: [
      { ...(GROUPS[0] as PaletteGroup), icon: 'i-lucide-file-text', color: 'info' },
      { ...(GROUPS[1] as PaletteGroup), icon: 'i-lucide-zap', color: 'warning' },
    ],
  },
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    const heading = within(list()).getByText('Pages');
    await expect(heading.querySelector('[data-icon="i-lucide-file-text"]')).toHaveClass('text-info');
    const signOut = within(list()).getAllByRole('option')[2] as HTMLElement;
    await expect(signOut.querySelector('[data-icon="i-lucide-log-out"]')).toHaveClass('text-warning');
  },
};

/** A group matched on the server keeps its items as they are, and a group's message is shown in place of them (4). */
export const SearchedGroup: Story = {
  args: {
    groups: [
      { id: 'entities', label: 'Entities', searched: true, items: [{ id: 'router', label: 'Edge router', description: 'Host' }] },
      { id: 'others', label: 'Others', searched: true, items: [], message: 'Search failed' },
    ],
  },
  render: (args) => ({
    components: { CommandPalette },
    setup: () => ({ args, searchTerm: ref('') }),
    template: '<CommandPalette v-bind="args" v-model:search-term="searchTerm" />',
  }),
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    // Found by its address, say: its title does not hold the words, and it stays.
    await userEvent.type(field(), '203.0.113');

    await waitFor(() => expect(within(list()).getAllByRole('option')).toHaveLength(1));
    await expect(within(dialog()).getByText('Search failed')).toBeVisible();
  },
};

/**
 * A group's message is said in the status with the count, and shown once outside the listbox, with an icon when it
 * failed; a group with nothing to list is no empty group in the listbox (4, review).
 */
export const FailedSearch: Story = {
  args: {
    groups: [
      { id: 'entities', label: 'Entities', searched: true, items: [], message: 'The search failed. Try again.', failed: true },
      GROUPS[0] as PaletteGroup,
    ],
  },
  render: (args) => ({
    components: { CommandPalette },
    setup: () => ({ args, searchTerm: ref('') }),
    template: '<CommandPalette v-bind="args" v-model:search-term="searchTerm" />',
  }),
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    await userEvent.type(field(), 'trace');

    const status = within(dialog()).getByRole('status');
    await waitFor(() => expect(status).toHaveTextContent(t('palette.results', { count: 1 }, 1)));
    await expect(status).toHaveTextContent('The search failed. Try again.');
    await expect(within(list()).queryByRole('group', { name: 'Entities' })).toBeNull();
    const message = within(dialog()).getByText('The search failed. Try again.');
    await expect(list().contains(message)).toBe(false);
    await expect(message.closest('p')?.querySelector('[data-icon="i-lucide-circle-alert"]')).toHaveClass('text-error');

    await userEvent.clear(field());
    await userEvent.type(field(), 'zzz');
    await waitFor(() => expect(status).toHaveTextContent('The search failed. Try again.'));
    await expect(within(dialog()).getAllByText('The search failed. Try again.')).toHaveLength(1);
  },
};

/** A part of a label in another language, such as a language's own name, is marked as such (review). */
export const ForeignPart: Story = {
  args: {
    groups: [{
      id: 'actions',
      label: 'Actions',
      items: [{ id: 'language', label: 'Switch language to Français', foreign: { text: 'Français', lang: 'fr-FR' } }],
    }],
  },
  play: async () => {
    await waitFor(() => expect(field()).toHaveFocus());
    const option = within(list()).getByRole('option');
    await expect(option.querySelector('[lang="fr-FR"]')).toHaveTextContent('Français');
    await expect(option).toHaveAccessibleName(/^Switch language to Français/);
  },
};

/** Once it has gone, it says so: what was chosen on the page then happens where screen readers hear it (review). */
export const AfterLeave: Story = {
  args: { onClosed: fn() },
  render: (args) => ({
    components: { CommandPalette },
    setup: () => ({ args, open: ref(true) }),
    template: '<CommandPalette v-bind="args" v-model:open="open" />',
  }),
  play: async ({ args }) => {
    await waitFor(() => expect(field()).toHaveFocus());
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(args.onClosed).toHaveBeenCalledOnce());
  },
};
