<script setup lang="ts">
import { isMac, paletteShortcutLabel } from '../../utils/palette-shortcut';

import { PALETTE_GROUPS } from '#shared/contracts/preferences';

/** What the command palette lists and searches: a checkbox per group, all checked until one is hidden. */
const props = defineProps<{
  hidden: readonly string[];
  /** The installed extensions, with i18n keys of their names and of their entity types'. */
  extensions?: readonly { id: string; name: string; entities: readonly { id: string; label: string }[] }[];
}>();
const emit = defineEmits<{ 'update:hidden': [hidden: string[]] }>();

const { t } = useI18n();
const hintId = useId();
// This computer's shortcut, as the sidebar shows it: known once mounted, so the server renders the same text.
const mac = ref(false);
onMounted(() => {
  mac.value = isMac();
});
const offId = useId();
const entitiesOff = computed(() => props.hidden.includes('group:entities'));
// An extension unchecked while Entities is on: its types cannot be changed, and say so.
const extensionOff = (id: string) => !entitiesOff.value && props.hidden.includes(`extension:${id}`);
const toggle = (key: string, shown: boolean | 'indeterminate') => {
  // Keys it does not show are kept as they were.
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
    <template
      v-for="group in PALETTE_GROUPS"
      :key="group"
    >
      <!-- Entities says why the extensions under it cannot be changed: disabled, they are skipped by Tab. -->
      <UCheckbox
        :model-value="!hidden.includes(`group:${group}`)"
        :label="t(`palette.groups.${group}`)"
        :aria-describedby="group === 'entities' && entitiesOff && extensions?.length ? offId : undefined"
        @update:model-value="toggle(`group:${group}`, $event)"
      />
      <!-- What Entities searches: each extension, and each of its types under it. -->
      <fieldset
        v-if="group === 'entities' && extensions?.length"
        class="ms-6 flex flex-col gap-2"
        :aria-describedby="entitiesOff ? offId : undefined"
      >
        <legend class="sr-only">
          {{ t('settings.palette.entitiesLegend') }}
        </legend>
        <p
          v-if="entitiesOff"
          :id="offId"
          class="text-sm text-muted"
        >
          {{ t('settings.palette.entitiesOff') }}
        </p>
        <template
          v-for="extension in extensions"
          :key="extension.id"
        >
          <UCheckbox
            :model-value="!hidden.includes(`extension:${extension.id}`)"
            :label="t(extension.name)"
            :disabled="entitiesOff"
            @update:model-value="toggle(`extension:${extension.id}`, $event)"
          />
          <p
            v-if="extensionOff(extension.id)"
            :id="`${offId}-${extension.id}`"
            class="ms-6 text-sm text-muted"
          >
            {{ t('settings.palette.extensionOff', { name: t(extension.name) }) }}
          </p>
          <UCheckbox
            v-for="entity in extension.entities"
            :key="entity.id"
            class="ms-6"
            :model-value="!hidden.includes(`type:${extension.id}/${entity.id}`)"
            :label="t(entity.label)"
            :disabled="entitiesOff || extensionOff(extension.id)"
            :aria-describedby="extensionOff(extension.id) ? `${offId}-${extension.id}` : undefined"
            @update:model-value="toggle(`type:${extension.id}/${entity.id}`, $event)"
          />
        </template>
      </fieldset>
    </template>
  </fieldset>
</template>
