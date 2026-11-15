<script setup lang="ts">
import { useExtensionLabels } from '../../composables/useExtensions';

import type { ExtensionImpact } from '../../../shared/contracts/extensions';

/** Confirms turning an extension on or off, with what changes with it. */
const props = defineProps<{
  open: boolean;
  extension: string;
  /** The state asked for. */
  enabled: boolean;
  /** What the server says would change, the asked extension first. */
  changes: ExtensionImpact[];
}>();
const emit = defineEmits<{ confirm: []; 'update:open': [open: boolean] }>();

const { t, locale } = useI18n();
const labels = useExtensionLabels();
const cancel = useTemplateRef<{ $el: HTMLElement }>('cancel');
// An alert dialog is described by its message: what changes, and that nothing is deleted.
const descriptionId = useId();

const name = computed(() => labels.extensionName(props.extension));
const title = computed(() => t(props.enabled ? 'workspaceExtensions.confirmOnTitle' : 'workspaceExtensions.confirmOffTitle', {
  name: name.value,
}));
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value);
const list = (names: string[]) => new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(names);
const others = computed(() => list(props.changes.filter(({ id }) => id !== props.extension)
  .map(({ id }) => labels.extensionName(id))));
// What stays saved but hidden, over every extension going off.
const hidden = computed(() => (props.enabled
  ? []
  : props.changes.flatMap(({ id, entities, derivedFlows }) => [
      ...entities.filter(({ count }) => count > 0).map(({ entity, count }) => t('workspaceExtensions.entityCount', {
        type: labels.entityPlural(id, entity), count: number(count),
      })),
      ...(derivedFlows > 0 ? [t('workspaceExtensions.derivedFlows', { count: number(derivedFlows) }, derivedFlows)] : []),
    ])));

// Nuxt UI types neither role nor aria-describedby on a dialog's content: both are passed through to the element. The
// least destructive answer takes the focus when it opens.
const content: Record<string, unknown> = {
  role: 'alertdialog',
  'aria-describedby': descriptionId,
  onOpenAutoFocus: (event: Event) => {
    event.preventDefault();
    cancel.value?.$el.focus();
  },
};
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :content="content"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div
        :id="descriptionId"
        class="flex flex-col gap-3"
      >
        <div v-if="hidden.length > 0">
          <p>{{ t('workspaceExtensions.hiddenData') }}</p>
          <ul class="mt-1 list-disc ps-5">
            <li
              v-for="line in hidden"
              :key="line"
            >
              {{ line }}
            </li>
          </ul>
        </div>
        <p v-if="others">
          {{ t(enabled ? 'workspaceExtensions.alsoOn' : 'workspaceExtensions.alsoOff', { names: others }) }}
        </p>
        <p v-if="!enabled">
          {{ t('workspaceExtensions.nothingDeleted') }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          ref="cancel"
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        >
          {{ t('workspaceExtensions.cancel') }}
        </UButton>
        <UButton
          :color="enabled ? 'primary' : 'error'"
          @click="emit('confirm')"
        >
          {{ enabled ? t('workspaceExtensions.turnOn') : t('workspaceExtensions.turnOff') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
