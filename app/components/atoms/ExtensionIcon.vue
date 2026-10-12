<script setup lang="ts">
const props = defineProps<{
  /** A Lucide icon name (`i-lucide-…`) or an image path. Missing, remote or broken icons show the generic fallback. */
  icon?: string;
}>();

/** Shown when an extension or a kind has no icon, or when its image does not load. */
const FALLBACK_ICON = 'i-lucide-puzzle';

/** Only images the app serves itself (an extension's public/ files); remote URLs are never loaded. */
const isSameOriginPath = (icon: string) => icon.startsWith('/') && !icon.startsWith('//');

const brokenImage = ref<string>();
const image = computed(() =>
  (props.icon && isSameOriginPath(props.icon) && props.icon !== brokenImage.value ? props.icon : undefined));
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
    class="extension-icon-image object-contain"
    @error="brokenImage = image"
  >
  <UIcon
    v-else
    :name="iconName"
    aria-hidden="true"
    :data-icon="iconName"
  />
</template>

<style>
/* 1em by default, like icons, so the image follows the text size. In a layer, so the caller's size class wins. */
@layer components {
  .extension-icon-image {
    width: 1em;
    height: 1em;
  }
}
</style>
