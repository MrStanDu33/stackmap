<script setup lang="ts">
export interface InventoryNavGroup {
  extension: string;
  /** The extension's translated name. */
  label: string;
  types: { key: string; label: string; to: string }[];
}

/**
 * The inventory's layout: the type navigation, grouped by extension, beside the current type's table on wide
 * screens and above it on narrow ones.
 */
defineProps<{
  groups: InventoryNavGroup[];
  /** `<extension>/<entity>` of the type shown. */
  current?: string;
  title: string;
  notFound: boolean;
  backTo: string;
}>();

const { t } = useI18n();
const heading = useTemplateRef<HTMLElement>('heading');

defineExpose({
  /** After the row that had the focus went away. */
  focusHeading: () => heading.value?.focus(),
});
</script>

<template>
  <div class="flex flex-col gap-6 md:flex-row">
    <nav
      :aria-label="t('inventory.types')"
      class="shrink-0 md:w-56"
    >
      <div
        v-for="group in groups"
        :key="group.extension"
        class="mb-4"
      >
        <p
          :id="`inventory-group-${group.extension}`"
          class="mb-1 text-xs font-semibold uppercase text-muted"
        >
          {{ group.label }}
        </p>
        <ul
          :aria-labelledby="`inventory-group-${group.extension}`"
          class="flex flex-wrap gap-1 md:flex-col"
        >
          <li
            v-for="type in group.types"
            :key="type.key"
          >
            <NuxtLink
              :to="type.to"
              :aria-current="type.key === current ? 'page' : undefined"
              class="block rounded-md px-2 py-1 text-sm hover:bg-elevated
                focus-visible:outline-2 focus-visible:outline-primary
                aria-[current=page]:bg-elevated aria-[current=page]:font-semibold aria-[current=page]:text-primary"
            >
              {{ type.label }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>
    <div class="min-w-0 flex-1">
      <h1
        ref="heading"
        tabindex="-1"
        class="mb-4 text-xl font-semibold focus-visible:outline-2 focus-visible:outline-primary"
      >
        {{ title }}
      </h1>
      <p v-if="notFound">
        <NuxtLink
          :to="backTo"
          class="text-primary underline"
        >
          {{ t('inventory.back') }}
        </NuxtLink>
      </p>
      <slot v-else />
    </div>
  </div>
</template>
