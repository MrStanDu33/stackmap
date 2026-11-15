<script setup lang="ts">
import type { WorkspaceExtension } from '../../../shared/contracts/extensions';

/** "What's in your stack?": a plain question per optional extension, all unchecked; the page turns on those chosen. */
const props = defineProps<{
  /** Null while loading. */
  extensions: WorkspaceExtension[] | null;
  /** The choice is being saved. */
  busy: boolean;
  /** Why the last save failed: the workspace already has data, or anything else. */
  error: 'not-empty' | 'failed' | null;
  /** Where the Extensions page of the workspace is. */
  extensionsPath: string;
}>();
const emit = defineEmits<{ submit: [ids: string[]]; skip: [] }>();

const { t } = useI18n();
const chosen = ref<string[]>([]);
const baseId = useId();
const toggle = (id: string, checked: boolean) => {
  chosen.value = checked ? [...chosen.value, id] : chosen.value.filter((other) => other !== id);
};

const items = computed(() => (props.extensions ?? []).filter(({ alwaysOn }) => !alwaysOn).map((extension) => ({
  value: extension.id,
  // An extension that asks no question is offered by its name.
  label: t(extension.onboarding ?? extension.name),
  description: t('onboarding.hint', { name: t(extension.name), description: t(extension.description) }),
})));

const submit = () => {
  if (!props.busy) {
    // In the order shown, whatever the order they were checked in.
    emit('submit', items.value.map(({ value }) => value).filter((id) => chosen.value.includes(id)));
  }
};
</script>

<template>
  <p
    v-if="!extensions"
    class="text-muted"
  >
    {{ t('onboarding.loading') }}
  </p>
  <form
    v-else
    class="flex flex-col gap-6"
    @submit.prevent="submit"
  >
    <!-- One checkbox each: UCheckboxGroup does not tie an item's description to its checkbox. -->
    <fieldset class="flex flex-col gap-4">
      <legend class="sr-only">
        {{ t('onboarding.title') }}
      </legend>
      <UCheckbox
        v-for="item in items"
        :id="`${baseId}-${item.value}`"
        :key="item.value"
        :model-value="chosen.includes(item.value)"
        :label="item.label"
        :aria-describedby="`${baseId}-${item.value}-description`"
        :ui="{ label: 'font-medium' }"
        @update:model-value="(checked) => toggle(item.value, checked === true)"
      >
        <template #description>
          <span :id="`${baseId}-${item.value}-description`">{{ item.description }}</span>
        </template>
      </UCheckbox>
    </fieldset>
    <i18n-t
      v-if="error === 'not-empty'"
      keypath="onboarding.notEmpty"
      tag="p"
      role="alert"
      scope="global"
      class="text-error"
    >
      <template #link>
        <ULink
          :to="extensionsPath"
          class="underline"
        >
          {{ t('onboarding.extensionsPage') }}
        </ULink>
      </template>
    </i18n-t>
    <p
      v-else-if="error === 'failed'"
      role="alert"
      class="text-error"
    >
      {{ t('onboarding.failed') }}
    </p>
    <div class="flex flex-wrap gap-2">
      <UButton
        type="submit"
        :loading="busy"
      >
        {{ t('onboarding.continue') }}
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        @click="emit('skip')"
      >
        {{ t('onboarding.skip') }}
      </UButton>
    </div>
  </form>
</template>
