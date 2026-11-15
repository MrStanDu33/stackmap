<script setup lang="ts">
import { useExtensionLabels } from '../../composables/useExtensions';

import type { OrphanItem } from '../../utils/orphan-item';

/** The hidden entities of a turned-off extension that connect to nothing: a count, and for admins delete or keep. */
const props = defineProps<{
  extension: string;
  /** Null while loading; empty for members who get the count only. */
  items: OrphanItem[] | null;
  /** How many there are, from the server: members below admin get no items. */
  count: number;
  truncated: boolean;
  failed: boolean;
  canManage: boolean;
  /** The ids of the entities being changed: their actions do nothing until then. */
  busy: readonly string[];
}>();
// `empty` once the last entity acted on leaves: nothing is left here to take the focus.
const emit = defineEmits<{ delete: [item: OrphanItem]; keep: [item: OrphanItem]; retry: []; empty: [] }>();

const { t } = useI18n();
const labels = useExtensionLabels();
const open = ref(false);
const listId = useId();
const descriptionId = useId();
// The item a confirmation names stays set while the dialog closes, so its title and button never go blank.
const confirming = ref<OrphanItem | null>(null);
const confirmOpen = ref(false);
const list = useTemplateRef<HTMLElement>('list');
const cancel = useTemplateRef<{ $el: HTMLElement }>('cancel');

// Busy rows keep their focusable buttons, said unavailable (aria-disabled) with a spinning icon: UButton's `loading`
// would disable them and drop the focus.
// The row whose action was last used, so that the focus follows when it leaves the list.
let acted: number | null = null;
let lengthWhenActed = 0;
const act = (item: OrphanItem, index: number, action: 'delete' | 'keep') => {
  if (props.busy.includes(item.id)) {
    return;
  }
  acted = index;
  lengthWhenActed = props.items?.length ?? 0;
  if (action === 'delete') {
    confirming.value = item;
    confirmOpen.value = true;
  } else {
    emit('keep', item);
  }
};
const confirm = () => {
  if (confirming.value) {
    emit('delete', confirming.value);
  }
  confirmOpen.value = false;
};
watch(() => props.items?.length, async (length, before) => {
  if (acted === null || length === undefined || before === undefined || length >= before) {
    return;
  }
  const row = Math.min(acted, length - 1);
  acted = null;
  if (length === 0) {
    emit('empty');
    return;
  }
  await nextTick();
  // The next row's first action, or the previous row's when the last one left.
  list.value?.querySelectorAll<HTMLElement>('li button:first-of-type')[row]?.focus();
});
// Nuxt UI types neither role nor aria-describedby on a dialog's content: both are passed through to the element.
const content: Record<string, unknown> = {
  role: 'alertdialog',
  'aria-describedby': descriptionId,
  onOpenAutoFocus: (event: Event) => {
    event.preventDefault();
    cancel.value?.$el.focus();
  },
  // The dialog has no trigger to return to: back on the row's Delete, which the watch moves on once the row leaves.
  onCloseAutoFocus: (event: Event) => {
    event.preventDefault();
    list.value?.querySelectorAll<HTMLElement>('li button:first-of-type')[acted ?? 0]?.focus();
  },
};
// An action that ended without the row leaving (a failure) no longer moves the focus later.
watch(() => props.busy.length, (length, before) => {
  if (length < before && props.items?.length === lengthWhenActed) {
    acted = null;
  }
});
</script>

<template>
  <div
    v-if="failed && !items"
    role="alert"
    class="flex flex-wrap items-center gap-3 text-sm"
  >
    <p>{{ t('workspaceExtensions.orphansFailed') }}</p>
    <UButton
      size="sm"
      color="neutral"
      variant="outline"
      icon="i-lucide-refresh-cw"
      @click="emit('retry')"
    >
      {{ t('workspaceExtensions.retry') }}
    </UButton>
  </div>
  <p
    v-else-if="!items"
    class="text-sm text-muted"
  >
    {{ t('workspaceExtensions.orphansLoading') }}
  </p>
  <div
    v-else-if="count > 0"
    class="flex flex-col gap-2 text-sm"
  >
    <div class="flex flex-wrap items-center gap-2">
      <p>{{ t('workspaceExtensions.orphans', { count }, count) }}</p>
      <UButton
        v-if="canManage"
        size="sm"
        color="neutral"
        variant="outline"
        :aria-label="t('workspaceExtensions.reviewOf', { extension: labels.extensionName(extension) })"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="listId"
        :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        @click="open = !open"
      >
        {{ t('workspaceExtensions.review') }}
      </UButton>
    </div>
    <div
      v-if="canManage && open"
      :id="listId"
    >
      <ul
        ref="list"
        class="flex flex-col gap-2"
      >
        <li
          v-for="(item, index) in items"
          :key="item.id"
          class="flex flex-wrap items-center gap-2 rounded-md border border-default p-2"
        >
          <span class="grow">
            <span class="font-medium">{{ item.name }}</span>
            <span class="text-muted"> · {{ item.type }}</span>
          </span>
          <UButton
            size="sm"
            color="error"
            variant="outline"
            :aria-disabled="busy.includes(item.id) ? 'true' : undefined"
            :leading-icon="busy.includes(item.id) ? 'i-lucide-loader-circle' : undefined"
            :ui="{ leadingIcon: 'motion-safe:animate-spin' }"
            @click="act(item, index, 'delete')"
          >
            {{ t('workspaceExtensions.deleteOrphan', { name: item.name }) }}
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            :aria-disabled="busy.includes(item.id) ? 'true' : undefined"
            :leading-icon="busy.includes(item.id) ? 'i-lucide-loader-circle' : undefined"
            :ui="{ leadingIcon: 'motion-safe:animate-spin' }"
            @click="act(item, index, 'keep')"
          >
            {{ t('workspaceExtensions.keepOrphan', { name: item.name }) }}
          </UButton>
        </li>
      </ul>
      <p
        v-if="truncated"
        class="mt-2 text-muted"
      >
        {{ t('workspaceExtensions.truncated', { count: 200 }) }}
      </p>
    </div>
    <UModal
      :open="confirmOpen"
      :title="confirming ? t('workspaceExtensions.deleteOrphan', { name: confirming.name }) : ''"
      :content="content"
      @update:open="confirmOpen = $event"
    >
      <template #body>
        <p :id="descriptionId">
          {{ confirming ? t('workspaceExtensions.confirmDeleteOrphan', { name: confirming.name }) : '' }}
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            ref="cancel"
            color="neutral"
            variant="outline"
            @click="confirmOpen = false"
          >
            {{ t('workspaceExtensions.cancel') }}
          </UButton>
          <UButton
            color="error"
            @click="confirm"
          >
            {{ confirming ? t('workspaceExtensions.deleteOrphan', { name: confirming.name }) : '' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
