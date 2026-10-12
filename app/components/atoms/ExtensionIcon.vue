<script setup lang="ts">
const props = defineProps<{
  /** A Lucide icon name (`i-lucide-…`) or an image URL. Missing or broken icons show the generic fallback. */
  icon?: string;
}>();

/** Shown when an extension or a kind has no icon, or when its image does not load. */
const FALLBACK_ICON = 'i-lucide-puzzle';

const brokenImage = ref<string>();
const image = computed(() =>
  (props.icon && !props.icon.startsWith('i-') && props.icon !== brokenImage.value ? props.icon : undefined));
const iconName = computed(() => (props.icon?.startsWith('i-') ? props.icon : FALLBACK_ICON));
</script>

<template>
  <!-- Decorative: screens always show the extension's or the kind's name next to it. -->
  <img
    v-if="image"
    :src="image"
    alt=""
    aria-hidden="true"
    :data-icon="image"
    class="object-contain"
    @error="brokenImage = image"
  >
  <UIcon
    v-else
    :name="iconName"
    aria-hidden="true"
    :data-icon="iconName"
  />
</template>
