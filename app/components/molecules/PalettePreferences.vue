<script setup lang="ts">
import { isMac, paletteShortcutLabel } from '../../utils/palette-shortcut';

import { PALETTE_GROUPS } from '#shared/contracts/preferences';

/** What the command palette lists and searches: a checkbox per group, all checked until one is hidden. */
const props = defineProps<{ hidden: readonly string[] }>();
const emit = defineEmits<{ 'update:hidden': [hidden: string[]] }>();

const { t } = useI18n();
const hintId = useId();
// This computer's shortcut, as the sidebar shows it: known once mounted, so the server renders the same text.
const mac = ref(false);
onMounted(() => {
  mac.value = isMac();
});
const toggle = (group: string, shown: boolean | 'indeterminate') => {
  const key = `group:${group}`;
  // Keys it does not show (extensions, types) are kept as they were.
  emit('update:hidden', shown === true
    ? props.hidden.filter((other) => other !== key)
    : [...new Set([...props.hidden, key])]);
};
</script>

<template>
  <fieldset
    class="flex flex-col gap-2"
    :aria-describedby="hintId"
  >
    <legend class="text-sm font-medium">
      {{ t('settings.palette.title') }}
    </legend>
    <p
      :id="hintId"
      class="text-sm text-muted"
    >
      {{ t('settings.palette.hint', { shortcut: paletteShortcutLabel(mac) }) }}
    </p>
    <UCheckbox
      v-for="group in PALETTE_GROUPS"
      :key="group"
      :model-value="!hidden.includes(`group:${group}`)"
      :label="t(`palette.groups.${group}`)"
      @update:model-value="toggle(group, $event)"
    />
  </fieldset>
</template>
