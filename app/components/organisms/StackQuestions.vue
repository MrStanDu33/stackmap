<script setup lang="ts">
import type { WorkspaceExtension } from '../../../shared/contracts/extensions';

/**
 * "What's in your stack?": what each optional extension adds (entity types and kinds), grouped under its question, all
 * unchecked; the page turns on every extension with an item chosen.
 */
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

const i18n = useI18n();
const { t } = i18n;
const baseId = useId();

interface Item {
  key: string;
  label: string;
  /** A kind says which entity it is a kind of. */
  hint?: string;
}
interface Group {
  extension: WorkspaceExtension;
  label: string;
  description: string;
  items: Item[];
}

// Kinds go on the core's entities: named by them, or by the entity's id when the core gives it no name (protocol).
const coreEntity = (entity: string) => {
  const key = `extensions.core.entities.${entity}`;
  return i18n.te(key) ? t(key) : entity;
};
const groups = computed<Group[]>(() => (props.extensions ?? []).filter(({ alwaysOn }) => !alwaysOn).map((extension) => {
  const entities = extension.entities.map(({ id }) => ({
    key: `${extension.id}:entity:${id}`,
    label: t(`extensions.${extension.id}.entitiesPlural.${id}`),
  }));
  const kinds = Object.entries(extension.kinds).flatMap(([entity, list]) => list.map(({ id, label }) => ({
    key: `${extension.id}:kind:${entity}:${id}`,
    label: t(label),
    hint: t('onboarding.kindHint', { entity: coreEntity(entity) }),
  })));
  const items = [...entities, ...kinds];
  return {
    extension,
    // An extension that asks no question is offered by its name.
    label: t(extension.onboarding ?? extension.name),
    description: t('onboarding.hint', { name: t(extension.name), description: t(extension.description) }),
    // One that adds nothing to choose from is a choice of its own.
    items: items.length > 0 ? items : [{ key: `${extension.id}:extension`, label: t(extension.name) }],
  };
}));

const chosen = ref<string[]>([]);
const announced = ref('');
const groupOf = (id: string) => groups.value.find(({ extension }) => extension.id === id);
const picked = (group: Group) => group.items.some(({ key }) => chosen.value.includes(key));

/** The optional extensions an extension needs, transitively, in the order shown. */
const needs = (group: Group): Group[] => {
  const reached = new Set<string>();
  const queue = [...group.extension.dependsOn];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const needed = groupOf(id);
    if (needed && !reached.has(id)) {
      reached.add(id);
      queue.push(...needed.extension.dependsOn);
    }
  }
  return groups.value.filter(({ extension }) => reached.has(extension.id));
};

const toggle = (group: Group, item: Item, checked: boolean) => {
  // Emptied first, so the same message twice is announced again.
  announced.value = '';
  if (!checked) {
    // Free to uncheck: the server turns on what a chosen extension needs anyway.
    chosen.value = chosen.value.filter((key) => key !== item.key);
    return;
  }
  // The extensions it needs that nothing was checked in yet get every item checked, and that is said.
  const added = needs(group).filter((needed) => !picked(needed)).flatMap(({ items }) => items);
  chosen.value = [...chosen.value, item.key, ...added.map(({ key }) => key)];
  if (added.length > 0) {
    announced.value = t('onboarding.alsoChecked', { item: item.label, names: added.map(({ label }) => label).join(', ') });
  }
};

const submit = () => {
  if (!props.busy) {
    // Every extension with an item checked, in the order shown.
    emit('submit', groups.value.filter(picked).map(({ extension }) => extension.id));
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
    <fieldset class="flex flex-col gap-6">
      <legend class="sr-only">
        {{ t('onboarding.title') }}
      </legend>
      <fieldset
        v-for="group in groups"
        :key="group.extension.id"
        :aria-describedby="`${baseId}-${group.extension.id}-description`"
        class="flex flex-col gap-2"
      >
        <legend class="font-medium">
          {{ group.label }}
        </legend>
        <p
          :id="`${baseId}-${group.extension.id}-description`"
          class="text-sm text-muted"
        >
          {{ group.description }}
        </p>
        <UCheckbox
          v-for="item in group.items"
          :id="`${baseId}-${item.key}`"
          :key="item.key"
          :model-value="chosen.includes(item.key)"
          :label="item.label"
          :aria-describedby="item.hint ? `${baseId}-${item.key}-hint` : undefined"
          @update:model-value="(checked) => toggle(group, item, checked === true)"
        >
          <template
            v-if="item.hint"
            #description
          >
            <span :id="`${baseId}-${item.key}-hint`">{{ item.hint }}</span>
          </template>
        </UCheckbox>
      </fieldset>
    </fieldset>
    <p
      role="status"
      class="text-sm text-muted"
    >
      {{ announced }}
    </p>
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
      <!-- Not `loading`, which disables the button and drops the focus: an error is then read from here. -->
      <UButton
        type="submit"
        :icon="busy ? 'i-lucide-loader-circle' : undefined"
        :ui="{ leadingIcon: 'motion-safe:animate-spin' }"
        :aria-busy="busy ? 'true' : undefined"
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
