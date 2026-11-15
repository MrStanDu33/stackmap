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
const root = useTemplateRef<HTMLElement>('root');
// The removed row's button had the focus: the row now in its place, else the one before, else Add a link.
const removeLink = async (index: number) => {
  const left = props.modelValue.links.length - 1;
  update({ links: props.modelValue.links.filter((_, at) => at !== index) });
  await nextTick();
  const next = left === 0 ? '[data-add-link]' : `[data-remove-link="${String(Math.min(index, left - 1))}"]`;
  root.value?.querySelector<HTMLElement>(next)?.focus();
};
const groupErrorId = computed(() => `${id('links')}-error`);
</script>

<template>
  <div
    ref="root"
    class="flex flex-col gap-4"
  >
    <EntityField
      :label="t('inventory.common.status')"
      :errors="issues.status"
    >
      <ChoiceSelect
        :id="id('status')"
        :model-value="modelValue.status"
        :items="statusItems"
        :readonly="readonly"
        @update:model-value="update({ status: $event })"
      />
    </EntityField>
    <EntityField
      :label="t('inventory.common.tags')"
      :hint="readonly ? undefined : t('inventory.common.tagsHint')"
      :errors="issues.tags"
    >
      <!-- Read-only, the tags as read-only text: reachable and at full contrast, unlike a disabled input. -->
      <UInput
        v-if="readonly"
        :id="id('tags')"
        :model-value="modelValue.tags.join(', ')"
        readonly
        class="w-full"
      />
      <UInputTags
        v-else
        :id="id('tags')"
        :model-value="modelValue.tags"
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
    <!-- Read-only, the links as links. -->
    <div
      v-if="readonly"
      class="flex flex-col gap-1"
    >
      <p class="text-sm font-medium">
        {{ t('inventory.common.links') }}
      </p>
      <ul
        v-if="modelValue.links.length > 0"
        class="list-disc ps-5"
      >
        <li
          v-for="(link, index) in modelValue.links"
          :key="index"
        >
          <a
            :href="link.url"
            class="text-primary underline"
            rel="noopener noreferrer"
            target="_blank"
          >{{ link.label }}</a>
        </li>
      </ul>
      <p
        v-else
        class="text-sm text-muted"
      >
        {{ t('inventory.none') }}
      </p>
    </div>
    <fieldset
      v-else
      :id="id('links')"
      tabindex="-1"
      :aria-describedby="issues.links?.length ? groupErrorId : undefined"
      class="flex flex-col gap-3"
    >
      <legend class="text-sm font-medium">
        {{ t('inventory.common.links') }}
      </legend>
      <p
        v-if="issues.links?.length"
        :id="groupErrorId"
        class="text-sm text-error"
      >
        {{ issues.links.join(' ') }}
      </p>
      <div
        v-for="(link, index) in modelValue.links"
        :key="index"
        class="flex flex-wrap items-start gap-2"
      >
        <EntityField
          :label="t('inventory.common.labelNumbered', { number: index + 1 })"
          :errors="issues[`links.${index}.label`]"
          class="min-w-32 flex-1"
        >
          <UInput
            :id="id(`links.${index}.label`)"
            :model-value="link.label"
            class="w-full"
            @update:model-value="updateLink(index, { label: String($event) })"
          />
        </EntityField>
        <EntityField
          :label="t('inventory.common.urlNumbered', { number: index + 1 })"
          :errors="issues[`links.${index}.url`]"
          class="min-w-48 flex-2"
        >
          <UInput
            :id="id(`links.${index}.url`)"
            :model-value="link.url"
            type="url"
            class="w-full"
            @update:model-value="updateLink(index, { url: String($event) })"
          />
        </EntityField>
        <UButton
          :data-remove-link="index"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          class="mt-6"
          :aria-label="t('inventory.common.removeLink', { number: index + 1 })"
          @click="removeLink(index)"
        />
      </div>
      <UButton
        data-add-link
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
