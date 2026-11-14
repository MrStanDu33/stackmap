<script setup lang="ts">
import { LANDING_PAGES } from '#shared/contracts/preferences';

type LandingPage = (typeof LANDING_PAGES)[number];

/** The page `/` opens: a radio group; Graph when nothing was chosen. */
const props = defineProps<{ modelValue: LandingPage | null }>();
const emit = defineEmits<{ 'update:modelValue': [page: LandingPage] }>();

const { t } = useI18n();
const hintId = useId();
const items = computed(() => LANDING_PAGES.map((value) => ({ label: t(`settings.landing.${value}`), value })));
const value = computed({
  get: () => props.modelValue ?? 'graph',
  set: (page: LandingPage) => {
    emit('update:modelValue', page);
  },
});
</script>

<template>
  <div class="flex flex-col gap-1">
    <URadioGroup
      v-model="value"
      :items="items"
      :legend="t('settings.landingPage')"
      :aria-label="t('settings.landingPage')"
      :aria-describedby="hintId"
    />
    <p
      :id="hintId"
      class="text-sm text-muted"
    >
      {{ t('settings.landingPageHint') }}
    </p>
  </div>
</template>
