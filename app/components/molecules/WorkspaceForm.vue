<script setup lang="ts">
import { slugify } from '../../utils/slugify';

import { KEBAB_CASE } from '#shared/contracts/formats';

type Field = 'name' | 'slug';

/** A new workspace's name and slug, the slug following the name until it is edited. */
const props = defineProps<{
  busy?: boolean;
  /** What the server said: the slug is taken, or Stackmap could not be reached. */
  error?: 'taken' | 'network' | null;
}>();
const emit = defineEmits<{ submit: [workspace: { name: string; slug: string }] }>();

const { t } = useI18n();
const name = ref('');
const slug = ref('');
const slugEdited = ref(false);
const fieldErrors = ref<Partial<Record<Field, string>>>({});

watch(name, (value) => {
  if (!slugEdited.value) {
    slug.value = slugify(value);
  }
});
const editSlug = (value: string) => {
  slugEdited.value = true;
  slug.value = value;
};

const form = useTemplateRef<HTMLFormElement>('form');
async function focusFirstError() {
  const first = (['name', 'slug'] as const).find((field) => fieldErrors.value[field]);
  if (!first) {
    return;
  }
  // The field's error is tied to it, so focusing it reads the error.
  await nextTick();
  form.value?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
}

const showServerError = (error?: 'taken' | 'network' | null) => {
  if (error === 'taken') {
    fieldErrors.value = { slug: 'workspace.error.slugTaken' };
    void focusFirstError();
  }
};
watch(() => props.error, showServerError);
onMounted(() => {
  showServerError(props.error);
});

/** Checks the fields as the server does; sends them, or shows the errors and moves focus to the first. */
const submit = async () => {
  // Fields stay focusable while busy (read-only, not disabled): a second press must not send twice.
  if (props.busy) {
    return;
  }
  const trimmed = name.value.trim();
  fieldErrors.value = {
    ...(trimmed && trimmed.length <= 100 ? {} : { name: 'workspace.error.name' }),
    ...(slug.value.length <= 48 && KEBAB_CASE.test(slug.value) ? {} : { slug: 'workspace.error.slug' }),
  };
  if (Object.keys(fieldErrors.value).length === 0) {
    emit('submit', { name: trimmed, slug: slug.value });
    return;
  }
  await focusFirstError();
};
</script>

<template>
  <form
    ref="form"
    class="flex flex-col gap-4"
    novalidate
    @submit.prevent="submit"
  >
    <UAlert
      v-if="error === 'network'"
      role="alert"
      color="error"
      variant="outline"
      :title="t('auth.error.network')"
    />
    <p class="text-sm text-muted">
      {{ t('auth.field.required') }}
    </p>
    <UFormField
      :label="t('workspace.new.name')"
      :error="fieldErrors.name && t(fieldErrors.name)"
      name="name"
      required
    >
      <UInput
        v-model="name"
        name="name"
        autocomplete="off"
        required
        maxlength="100"
        :readonly="busy"
        class="w-full"
      />
    </UFormField>
    <UFormField
      :label="t('workspace.new.slug')"
      :description="t('workspace.new.slugHint', { slug: slug || t('workspace.new.slugExample') })"
      :error="fieldErrors.slug && t(fieldErrors.slug)"
      name="slug"
      required
    >
      <UInput
        :model-value="slug"
        name="slug"
        autocomplete="off"
        spellcheck="false"
        autocapitalize="none"
        required
        maxlength="48"
        :readonly="busy"
        class="w-full"
        @update:model-value="editSlug(String($event))"
      />
    </UFormField>
    <UButton
      type="submit"
      :icon="busy ? 'i-lucide-loader-circle' : undefined"
      :ui="{ leadingIcon: 'motion-safe:animate-spin' }"
      :aria-busy="busy ? 'true' : undefined"
      class="self-start"
    >
      {{ t('workspace.new.submit') }}
    </UButton>
  </form>
</template>
