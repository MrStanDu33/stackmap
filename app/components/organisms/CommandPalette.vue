<script setup lang="ts">
import type { PaletteGroup, PaletteItem } from '../../utils/palette';

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
}>();
const emit = defineEmits<{ 'update:open': [open: boolean]; select: [item: PaletteItem, group: PaletteGroup] }>();
const searchTerm = defineModel<string>('searchTerm', { default: '' });

const { t } = useI18n();
const baseId = useId();
const listId = `${baseId}-list`;

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// Filtered here: the count said is the count shown.
const shown = computed(() => {
  const words = normalize(searchTerm.value).split(/\s+/).filter(Boolean);
  return props.groups
    .map((group) => ({
      ...group,
      items: group.items.filter(({ label, description }) =>
        words.every((word) => normalize(`${label} ${description ?? ''}`).includes(word))),
    }))
    .filter(({ items }) => items.length > 0);
});
/** Every option in order, with its id in the listbox. */
const options = computed(() => shown.value.flatMap((group) => group.items.map((item, index) => ({
  item, group, id: `${baseId}-${group.id}-${String(index)}`,
}))));
const count = computed(() => options.value.length);
const active = ref(0);
// A new search starts from the first result; an index past the list is never pointed at.
watch(options, () => {
  active.value = 0;
});
const field = useTemplateRef<{ inputRef?: HTMLInputElement | null }>('field');
// Nuxt UI types no focus handler on a dialog's content: it is passed through to the element.
const content: Record<string, unknown> = {
  onOpenAutoFocus: (event: Event) => {
    event.preventDefault();
    field.value?.inputRef?.focus();
  },
};
const activeId = computed(() => options.value[active.value]?.id);

const choose = (index: number) => {
  const option = options.value[index];
  if (option) {
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
    :ui="{ header: 'sr-only', body: 'p-0 sm:p-0' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-col">
        <UInput
          ref="field"
          v-model="searchTerm"
          variant="none"
          size="lg"
          icon="i-lucide-search"
          :loading="loading"
          :placeholder="t('palette.placeholder')"
          :ui="{ root: 'w-full border-b border-default', leadingIcon: 'motion-safe:animate-none' }"
          role="combobox"
          aria-autocomplete="list"
          :aria-label="t('palette.title')"
          :aria-expanded="count > 0 ? 'true' : 'false'"
          :aria-controls="listId"
          :aria-activedescendant="activeId"
          @keydown="onKeydown"
        />
        <div
          :id="listId"
          role="listbox"
          :aria-label="t('palette.title')"
          class="max-h-96 overflow-y-auto p-1"
        >
          <div
            v-for="group in shown"
            :key="group.id"
            role="group"
            :aria-labelledby="`${baseId}-${group.id}-label`"
          >
            <div
              :id="`${baseId}-${group.id}-label`"
              role="presentation"
              class="px-2 py-1 text-xs font-semibold text-muted"
            >
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
              :aria-label="t('palette.option', { label: option.item.label, group: group.label })"
              class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm"
              :class="option.id === activeId ? 'bg-elevated' : ''"
              @mousedown.prevent
              @click="choose(options.indexOf(option))"
            >
              <UIcon
                v-if="option.item.icon"
                :name="option.item.icon"
                class="size-4 shrink-0 text-muted"
                aria-hidden="true"
              />
              <span class="grow truncate">{{ option.item.label }}</span>
              <span
                v-if="option.item.description"
                class="text-xs text-muted"
              >{{ option.item.description }}</span>
            </div>
            <!-- eslint-enable vuejs-accessibility/click-events-have-key-events -->
            <!-- eslint-enable vuejs-accessibility/interactive-supports-focus -->
          </div>
        </div>
        <p
          v-if="count === 0 && searchTerm.trim() !== '' && !loading"
          class="px-3 py-6 text-center text-sm text-muted"
        >
          {{ t('palette.empty', { q: searchTerm.trim() }) }}
        </p>
        <p
          role="status"
          class="sr-only"
        >
          {{ loading ? t('palette.searching') : t('palette.results', { count }, count) }}
        </p>
      </div>
    </template>
  </UModal>
</template>
