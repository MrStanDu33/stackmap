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
const emit = defineEmits<{ 'update:open': [open: boolean]; confirm: [] }>();

const { t } = useI18n();
// Nuxt UI types no role on a dialog's content; a confirmation is an alert dialog (passed through to the element).
const ALERT_DIALOG: Record<string, unknown> = { role: 'alertdialog' };
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
    :content="ALERT_DIALOG"
    @update:open="emit('update:open', $event)"
  >
    <template
      v-if="inUse"
      #body
    >
      <div
        role="alert"
        tabindex="-1"
      >
        <p>{{ t('inventory.inUse', { name }) }}</p>
        <ul
          v-if="inUse !== 'unknown'"
          class="mt-2 list-disc ps-5"
        >
          <li
            v-for="dependent in inUse"
            :key="dependent.label"
          >
            {{ t('inventory.inUseCount', { count: dependent.count, entity: dependent.label }) }}
          </li>
        </ul>
        <p v-else>
          {{ t('inventory.inUseUnknown') }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        >
          {{ inUse ? t('inventory.close') : t('inventory.cancel') }}
        </UButton>
        <UButton
          v-if="!inUse"
          color="error"
          :disabled="busy"
          :aria-busy="busy ? 'true' : undefined"
          @click="confirm"
        >
          {{ t('inventory.delete', { name }) }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
