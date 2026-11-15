<script setup lang="ts">
import { ENTITY_STATUSES } from '@stackmap/extension-sdk/entities';

import { fieldId } from '../../composables/useEntityForm';

import type { EntityLink } from '@stackmap/extension-sdk/entities';

export interface CommonValues {
  status: string;
  tags: string[];
  notes: string;
  links: EntityLink[];
}

/** The fields every entity has, in every inventory form: status, tags, notes and links; origin when imported. */
const props = defineProps<{
  formId: string;
  modelValue: CommonValues;
  /** Translated messages by field path: `links.0.url`. */
  issues: Record<string, string[]>;
  readonly: boolean;
  origin: string;
  externalRef: string | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: CommonValues] }>();

const { t } = useI18n();
const id = (path: string) => fieldId(props.formId, path);
const statusItems = computed(() => ENTITY_STATUSES
  .map((value): { value: string; label: string } => ({ value, label: t(`inventory.status.${value}`) })));

const update = (change: Partial<CommonValues>) => {
  emit('update:modelValue', { ...props.modelValue, ...change });
};
const updateLink = (index: number, change: Partial<EntityLink>) => {
  update({
    links: props.modelValue.links.map((link, at) => (at === index ? { ...link, ...change } : link)),
  });
};
const addLink = async () => {
  update({ links: [...props.modelValue.links, { label: '', url: '' }] });
  await nextTick();
  document.getElementById(id(`links.${String(props.modelValue.links.length - 1)}.label`))?.focus();
};
const removeLink = (index: number) => {
  update({ links: props.modelValue.links.filter((_, at) => at !== index) });
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <EntityField
      :label="t('inventory.common.status')"
      :errors="issues.status"
    >
      <USelect
        :id="id('status')"
        :model-value="modelValue.status"
        :items="statusItems"
        value-key="value"
        :disabled="readonly"
        class="w-full"
        @update:model-value="update({ status: $event as string })"
      />
    </EntityField>
    <EntityField
      :label="t('inventory.common.tags')"
      :hint="readonly ? undefined : t('inventory.common.tagsHint')"
      :errors="issues.tags"
    >
      <UInputTags
        :id="id('tags')"
        :model-value="modelValue.tags"
        :disabled="readonly"
        :add-on-blur="true"
        class="w-full"
        @update:model-value="update({ tags: [...new Set($event as string[])] })"
      />
    </EntityField>
    <EntityField
      :label="t('inventory.common.notes')"
      :hint="t('inventory.common.notesHint')"
      :errors="issues.notes"
    >
      <UTextarea
        :id="id('notes')"
        :model-value="modelValue.notes"
        :readonly="readonly"
        :rows="3"
        autoresize
        class="w-full"
        @update:model-value="update({ notes: String($event) })"
      />
    </EntityField>
    <fieldset class="flex flex-col gap-3">
      <legend class="text-sm font-medium">
        {{ t('inventory.common.links') }}
      </legend>
      <div
        v-for="(link, index) in modelValue.links"
        :key="index"
        class="flex flex-wrap items-start gap-2"
      >
        <EntityField
          :label="`${t('inventory.common.label')} ${index + 1}`"
          :errors="issues[`links.${index}.label`]"
          class="min-w-32 flex-1"
        >
          <UInput
            :id="id(`links.${index}.label`)"
            :model-value="link.label"
            :readonly="readonly"
            class="w-full"
            @update:model-value="updateLink(index, { label: String($event) })"
          />
        </EntityField>
        <EntityField
          :label="`${t('inventory.common.url')} ${index + 1}`"
          :errors="issues[`links.${index}.url`]"
          class="min-w-48 flex-2"
        >
          <UInput
            :id="id(`links.${index}.url`)"
            :model-value="link.url"
            type="url"
            :readonly="readonly"
            class="w-full"
            @update:model-value="updateLink(index, { url: String($event) })"
          />
        </EntityField>
        <UButton
          v-if="!readonly"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          class="mt-6"
          :aria-label="t('inventory.common.removeLink', { number: index + 1 })"
          @click="removeLink(index)"
        />
      </div>
      <UButton
        v-if="!readonly"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="addLink"
      >
        {{ t('inventory.common.addLink') }}
      </UButton>
    </fieldset>
    <dl
      v-if="origin !== 'manual'"
      class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
    >
      <dt class="text-muted">
        {{ t('inventory.common.origin') }}
      </dt>
      <dd>{{ origin }}</dd>
      <template v-if="externalRef">
        <dt class="text-muted">
          {{ t('inventory.common.externalRef') }}
        </dt>
        <dd>{{ externalRef }}</dd>
      </template>
    </dl>
  </div>
</template>
