<script setup lang="ts">
/**
 * A field of an inventory form: its label (with "required" in words), its hint and its translated errors. The control
 * in the slot sets its own id (`<formId>-<path>`), which the label and the error summary point to.
 */
const props = defineProps<{
  label: string;
  required?: boolean;
  errors?: string[];
  hint?: string;
}>();

const { t } = useI18n();
const error = computed(() => (props.errors?.length ? props.errors.join(' ') : undefined));
</script>

<template>
  <UFormField
    :required="required"
    :error="error"
    :description="hint"
  >
    <template #label>
      {{ label }}<span
        v-if="required"
        class="sr-only"
      > {{ t('inventory.required') }}</span>
    </template>
    <slot />
  </UFormField>
</template>
