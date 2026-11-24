<script setup lang="ts">
import { matchMarks, matchRank } from '../../utils/palette-match';

import type { PaletteColor, PaletteFilterOption, PaletteGroup, PaletteItem } from '../../utils/palette';

/**
 * The command palette: a search field over groups of results, in a dialog. A combobox and listbox of its own (ARIA
 * 1.2): UCommandPalette leaves its listbox unnamed, empty of options when nothing matches, and points
 * aria-activedescendant at options it removed.
 */
const props = defineProps<{
  open: boolean;
  groups: PaletteGroup[];
  /** Results are being fetched. */
  loading?: boolean;
  /** The filter chip chosen, if any. */
  filter?: PaletteFilterOption | null;
}>();
const emit = defineEmits<{
  'update:open': [open: boolean];
  select: [item: PaletteItem, group: PaletteGroup];
  /** It has gone, its closing animation over: the page is no longer hidden from screen readers. */
  closed: [];
  /** The chip removed (null). */
  'update:filter': [filter: PaletteFilterOption | null];
}>();
const searchTerm = defineModel<string>('searchTerm', { default: '' });

const { t } = useI18n();
const baseId = useId();
const listId = `${baseId}-list`;

// Literal classes, so that Tailwind generates them.
const COLORS: Record<PaletteColor, string> = {
  primary: 'text-primary', info: 'text-info', secondary: 'text-secondary', warning: 'text-warning',
};
const colorOf = (group: PaletteGroup) => (group.color ? COLORS[group.color] : 'text-muted');
// Filtered here: the count said is the count shown. Each group lists its most exact match first.
const shown = computed(() => {
  const typed = searchTerm.value.trim() !== '';
  return props.groups
    .map((group) => ({
      ...group,
      // A group matched on the server shows what it found, in its order: its titles may not hold the words.
      items: group.searched || !typed
        ? group.items
        : group.items
            .map((item) => ({ item, rank: matchRank(item.match ?? item.label, searchTerm.value) }))
            .filter((ranked): ranked is { item: PaletteItem; rank: number } => ranked.rank !== undefined)
            .sort((one, other) => one.rank - other.rank)
            .map(({ item }) => item),
    }))
    .filter(({ items, message }) => items.length > 0 || message !== undefined);
});
/** Every option in order, with its id in the listbox. */
const options = computed(() => shown.value.flatMap((group) => group.items.map((item, index) => ({
  item, group, id: `${baseId}-${group.id}-${String(index)}`,
}))));
// Only groups with options in the listbox; a group's message (searching, failed) is shown once, outside it.
const listed = computed(() => shown.value.filter(({ items }) => items.length > 0));
const message = computed(() => shown.value.find((group) => group.message));
/**
 * The label in runs: the characters that matched what is typed are bold, and a part in another language (a language's
 * own name) is read in its voice.
 */
const segments = (item: PaletteItem, group: PaletteGroup) => {
  // What the server found is not marked: it may have matched an address, not the title.
  const text = item.match ?? (group.searched ? '' : item.label);
  // Only the part matched (a filter's name), wherever the translation puts it in the label; a filter offered through
  // another of its names (a plural) marks the letters its name holds.
  const offset = text ? item.label.lastIndexOf(text) : -1;
  const found = offset >= 0 ? matchMarks(text, searchTerm.value, { partial: item.match !== undefined }) : [];
  const marked = new Set(found.map((index) => index + offset));
  const foreignAt = item.foreign ? item.label.indexOf(item.foreign.text) : -1;
  const langAt = (index: number) => (item.foreign && foreignAt >= 0 && index >= foreignAt
    && index < foreignAt + item.foreign.text.length
    ? item.foreign.lang
    : undefined);
  const runs: { text: string; bold: boolean; lang?: string }[] = [];
  Array.from(item.label).forEach((character, index) => {
    const bold = marked.has(index);
    const lang = langAt(index);
    const last = runs.at(-1);
    if (last && last.bold === bold && last.lang === lang) {
      last.text += character;
    } else {
      runs.push({ text: character, bold, ...(lang ? { lang } : {}) });
    }
  });
  return runs;
};
const count = computed(() => options.value.length);
const active = ref(0);
// A new search starts from the first result; an index past the list is never pointed at.
// The option a choice asked to come back to (Back: the entry it left), once the list it changes arrives.
let returning: string | undefined;
watch(options, () => {
  const back = returning ? options.value.findIndex(({ item }) => item.id === returning) : -1;
  returning = undefined;
  active.value = Math.max(back, 0);
});
const field = useTemplateRef<{ inputRef?: HTMLInputElement | null }>('field');
// Nuxt UI types no focus handler on a dialog's content: it is passed through to the element.
const content: Record<string, unknown> = {
  onOpenAutoFocus: (event: Event) => {
    event.preventDefault();
    field.value?.inputRef?.focus();
  },
};
// Said once typing settles, and nothing before anything is typed: then the results, after a chip that came or went,
// or a list that changed (the extension filters, and back).
const announced = ref('');
let settle: ReturnType<typeof setTimeout> | undefined;
let change = '';
let listChanged = false;
// What the last change saw: a chip that came or went, and the groups listed.
let chipBefore = props.filter?.name;
const groupsShown = () => props.groups.map(({ id, label }) => `${id}:${label}`).join('|');
let listBefore = groupsShown();
watch(
  [searchTerm, count, () => props.loading, () => message.value?.message, () => props.filter?.name, groupsShown],
  () => {
    const chip = props.filter?.name;
    if (chip !== chipBefore) {
      change = chip ? t('palette.filters.added', { name: chip }) : t('palette.filters.removed', { name: chipBefore });
      chipBefore = chip;
    }
    const list = groupsShown();
    listChanged ||= list !== listBefore;
    listBefore = list;
    clearTimeout(settle);
    settle = setTimeout(() => {
      const results = searchTerm.value.trim() !== '' || props.filter || listChanged || change !== '';
      announced.value = props.loading
        ? t('palette.searching')
        : [change, results ? t('palette.results', { count: count.value }, count.value) : '', message.value?.message ?? '']
            .filter(Boolean).join(' ');
      change = '';
      listChanged = false;
    }, 250);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  clearTimeout(settle);
});
const activeId = computed(() => options.value[active.value]?.id);

const chipId = `${baseId}-chip`;
// The chip goes and its word comes back to the field, which keeps the focus.
const removeFilter = () => {
  if (props.filter) {
    searchTerm.value = props.filter.word;
    emit('update:filter', null);
    field.value?.inputRef?.focus();
  }
};

const choose = (index: number) => {
  const option = options.value[index];
  if (option) {
    returning = option.item.returnTo;
    const group = props.groups.find(({ id }) => id === option.group.id) ?? option.group;
    emit('select', option.item, group);
  }
};
const move = (step: number) => {
  if (count.value > 0) {
    active.value = (active.value + step + count.value) % count.value;
    void nextTick(() => document.getElementById(activeId.value ?? '')?.scrollIntoView({ block: 'nearest' }));
  }
};
// Home and End stay with the text field, as in the ARIA combobox pattern.
const onKeydown = (event: KeyboardEvent) => {
  // An input method composing text (Chinese, Japanese…) uses the arrows and Enter itself.
  if (event.isComposing) {
    return;
  }
  if (event.key === 'Backspace' && searchTerm.value === '' && props.filter) {
    event.preventDefault();
    removeFilter();
    return;
  }
  const keys: Record<string, (() => void) | undefined> = {
    ArrowDown: () => { move(1); },
    ArrowUp: () => { move(-1); },
    Enter: () => { choose(active.value); },
  };
  const action = keys[event.key];
  if (action) {
    event.preventDefault();
    action();
  }
};
</script>

<template>
  <UModal
    :open="open"
    :title="t('palette.title')"
    :content="content"
    :close="false"
    :ui="{ header: 'sr-only', body: 'p-0 sm:p-0' }"
    @update:open="emit('update:open', $event)"
    @after:leave="emit('closed')"
  >
    <template #body>
      <div class="flex flex-col">
        <div class="flex items-center border-b border-default">
          <!-- The chip comes before the words, in the same field: one combobox, described by the filter it applies. -->
          <span
            v-if="filter"
            class="ms-2 flex shrink-0 items-center gap-1 rounded-md bg-elevated ps-2 text-sm font-medium"
          >
            <UIcon
              v-if="filter.icon"
              :name="filter.icon"
              :data-icon="filter.icon"
              class="size-4 shrink-0"
              :class="filter.color ? COLORS[filter.color] : 'text-muted'"
              aria-hidden="true"
            />
            <span
              :id="chipId"
              class="sr-only"
            >{{ t('palette.filters.chip', { name: filter.name }) }}</span>
            <span aria-hidden="true">{{ filter.name }}</span>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('palette.filters.remove', { name: filter.name })"
              @click="removeFilter"
            />
          </span>
          <UInput
            ref="field"
            v-model="searchTerm"
            variant="none"
            size="lg"
            :icon="filter ? undefined : 'i-lucide-search'"
            :loading="loading"
            :placeholder="t('palette.placeholder')"
            :ui="{
              root: 'w-full',
              base: 'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
            }"
            role="combobox"
            aria-autocomplete="list"
            :aria-label="t('palette.title')"
            :aria-describedby="filter ? chipId : undefined"
            :aria-expanded="count > 0 ? 'true' : 'false'"
            :aria-controls="listId"
            :aria-activedescendant="activeId"
            @keydown="onKeydown"
          />
        </div>
        <!-- Only with results: an empty listbox has nothing to choose; the field then says it is collapsed. -->
        <div
          v-if="count > 0"
          :id="listId"
          role="listbox"
          :aria-label="t('palette.resultsLabel')"
          class="max-h-96 overflow-y-auto p-1"
        >
          <div
            v-for="group in listed"
            :key="group.id"
            role="group"
            :aria-labelledby="`${baseId}-${group.id}-label`"
          >
            <div
              :id="`${baseId}-${group.id}-label`"
              role="presentation"
              class="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted"
            >
              <UIcon
                v-if="group.icon"
                :name="group.icon"
                :data-icon="group.icon"
                class="size-3.5"
                :class="colorOf(group)"
                aria-hidden="true"
              />
              {{ group.label }}
            </div>
            <!-- Reached through the combobox's aria-activedescendant, not focus; the mouse chooses one too. -->
            <!-- eslint-disable vuejs-accessibility/click-events-have-key-events -->
            <!-- eslint-disable vuejs-accessibility/interactive-supports-focus -->
            <div
              v-for="option in options.filter((candidate) => candidate.group.id === group.id)"
              :id="option.id"
              :key="option.id"
              role="option"
              :aria-selected="option.id === activeId ? 'true' : 'false'"
              :aria-describedby="option.item.description ? `${option.id}-description` : undefined"
              class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm"
              :class="option.id === activeId ? 'bg-elevated text-highlighted ring-2 ring-inset ring-primary' : ''"
              @mousedown.prevent
              @click="choose(options.indexOf(option))"
            >
              <UIcon
                v-if="option.item.icon"
                :name="option.item.icon"
                :data-icon="option.item.icon"
                class="size-4 shrink-0"
                :class="colorOf(group)"
                aria-hidden="true"
              />
              <!-- Named by its label, then its group for screen readers: the visible text starts its name. -->
              <!-- Plain runs are text, not elements: spaces at an element's edge drop out of the accessible name. -->
              <span class="grow truncate"><template
                v-for="(segment, index) in segments(option.item, group)"
                :key="index"
              ><span
                v-if="segment.bold || segment.lang"
                :lang="segment.lang"
                :data-match="segment.bold ? '' : undefined"
                :class="segment.bold ? 'font-bold' : undefined"
              >{{ segment.text }}</span><template v-else>{{ segment.text }}</template></template><span
                class="sr-only"
              >{{ t('palette.inGroup', { group: group.label }) }}</span></span>
              <!-- Read as the option's description (aria-describedby), not again as part of its name. -->
              <span
                v-if="option.item.description"
                :id="`${option.id}-description`"
                aria-hidden="true"
                class="text-xs text-muted"
              >{{ option.item.description }}</span>
              <!-- Beyond the ring: Enter chooses this one. -->
              <UIcon
                v-if="option.id === activeId"
                name="i-lucide-corner-down-left"
                class="size-4 shrink-0"
                aria-hidden="true"
              />
            </div>
            <!-- eslint-enable vuejs-accessibility/click-events-have-key-events -->
            <!-- eslint-enable vuejs-accessibility/interactive-supports-focus -->
          </div>
        </div>
        <p
          v-if="message"
          class="flex items-center justify-center gap-1.5 px-3 py-3 text-sm text-muted"
        >
          <UIcon
            v-if="message.failed"
            name="i-lucide-circle-alert"
            data-icon="i-lucide-circle-alert"
            class="size-4 shrink-0 text-error"
            aria-hidden="true"
          />
          {{ message.message }}
        </p>
        <p
          v-else-if="count === 0 && searchTerm.trim() !== ''"
          class="px-3 py-6 text-center text-sm text-muted"
        >
          {{ t('palette.empty', { q: searchTerm.trim() }) }}
        </p>
        <p
          role="status"
          class="sr-only"
        >
          {{ announced }}
        </p>
      </div>
    </template>
  </UModal>
</template>
