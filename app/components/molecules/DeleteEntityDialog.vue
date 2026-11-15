<script setup lang="ts">
/** Asks before deleting an entity; after a refusal, lists what still uses it instead. */
const props = defineProps<{
  open: boolean;
  name: string;
  busy: boolean;
  /** The deletion failed for another reason than its dependents: said in the dialog, which stays open. */
  failed?: boolean;
  /** The dependents a refusal named, `unknown` when it named none, `null` before any refusal. */
  inUse: { label: string; count: number }[] | 'unknown' | null;
}>();
const emit = defineEmits<{
  'update:open': [open: boolean];
  confirm: [];
  /** When it would return focus to Delete: prevented, the page moves focus itself and then announces. */
  closeAutoFocus: [event: Event];
}>();

const { t, locale } = useI18n();
// Nuxt UI types no role on a dialog's content; a confirmation is an alert dialog (passed through to the element).
const ALERT_DIALOG: Record<string, unknown> = { role: 'alertdialog' };
const cancel = useTemplateRef<{ $el: HTMLElement }>('cancel');
const refusal = useTemplateRef<HTMLElement>('refusal');
const count = (value: number) => new Intl.NumberFormat(locale.value).format(value);

// The least destructive answer takes the focus when it opens.
const onOpenAutoFocus = (event: Event) => {
  event.preventDefault();
  cancel.value?.$el.focus();
};
// Refused or failed, Delete goes away or stays unavailable: the alert takes the focus, so it is read.
watch(() => [props.inUse, props.failed], async ([inUse, failed]) => {
  if (inUse || failed) {
    await nextTick();
    refusal.value?.focus();
  }
});
const confirm = () => {
  if (!props.busy) {
    emit('confirm');
  }
};
</script>

<template>
  <UModal
    :open="open"
    :title="t('inventory.delete', { name })"
    :description="inUse ? undefined : t('inventory.confirmDelete', { name })"
    :content="{ ...ALERT_DIALOG, onOpenAutoFocus, onCloseAutoFocus: (event: Event) => emit('closeAutoFocus', event) }"
    @update:open="emit('update:open', $event)"
  >
    <template
      v-if="inUse || failed"
      #body
    >
      <div
        ref="refusal"
        role="alert"
        tabindex="-1"
        class="focus-visible:outline-2 focus-visible:outline-primary"
      >
        <p v-if="failed && !inUse">
          {{ t('inventory.deleteFailed', { name }) }}
        </p>
        <template v-else-if="inUse">
          <p>{{ t('inventory.inUse', { name }) }}</p>
          <ul
            v-if="inUse !== 'unknown'"
            class="mt-2 list-disc ps-5"
          >
            <li
              v-for="dependent in inUse"
              :key="dependent.label"
            >
              {{ t('inventory.inUseCount', { count: count(dependent.count), entity: dependent.label }) }}
            </li>
          </ul>
          <p v-else>
            {{ t('inventory.inUseUnknown') }}
          </p>
        </template>
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
          {{ inUse ? t('inventory.close') : t('inventory.cancel') }}
        </UButton>
        <UButton
          v-if="!inUse"
          color="error"
          :aria-disabled="busy ? 'true' : undefined"
          :aria-busy="busy ? 'true' : undefined"
          @click="confirm"
        >
          {{ t('inventory.delete', { name }) }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
