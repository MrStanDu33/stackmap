<script setup lang="ts">
import { MIN_PASSWORD } from '#shared/contracts/auth';

type Field = 'name' | 'email' | 'password';

/** The first administrator's account, and whether to add the demo workspace. */
const props = defineProps<{
  busy?: boolean;
  /** Errors the server found, by field, as i18n keys. */
  errors?: Partial<Record<Field, string>>;
}>();
const emit = defineEmits<{ submit: [account: { name: string; email: string; password: string; demo: boolean }] }>();

const { t } = useI18n();
const name = ref('');
const email = ref('');
const password = ref('');
const demo = ref(true);
const shown = ref(false);
const fieldErrors = ref<Partial<Record<Field, string>>>({});
const announcement = ref('');

watch(() => props.errors, (errors) => {
  if (errors && Object.keys(errors).length > 0) {
    fieldErrors.value = { ...errors };
    void focusFirstError();
  }
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A parameter: vue-i18n reads `@` in a message as a link to another message.
const EXAMPLE = { example: 'admin@homelab.example' };

const form = useTemplateRef<HTMLFormElement>('form');
async function focusFirstError() {
  const first = (['name', 'email', 'password'] as const).find((field) => fieldErrors.value[field]);
  if (!first) {
    return;
  }
  // Emptied first, so the same error said twice is still announced.
  announcement.value = '';
  await nextTick();
  announcement.value = t(fieldErrors.value[first] ?? '', EXAMPLE);
  form.value?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
}

/** Checks the fields as the server does; sends them, or shows the errors and moves focus to the first. */
const submit = async () => {
  fieldErrors.value = {
    ...(name.value.trim() ? {} : { name: 'auth.error.name' }),
    ...(EMAIL.test(email.value.trim()) ? {} : { email: 'auth.error.email' }),
    ...(password.value.length >= MIN_PASSWORD ? {} : { password: 'auth.error.password' }),
  };
  if (Object.keys(fieldErrors.value).length === 0) {
    emit('submit', { name: name.value.trim(), email: email.value.trim(), password: password.value, demo: demo.value });
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
    <UFormField
      :label="t('auth.field.name')"
      :error="fieldErrors.name && t(fieldErrors.name, EXAMPLE)"
      name="name"
    >
      <UInput
        v-model="name"
        name="name"
        autocomplete="name"
        :disabled="busy"
        class="w-full"
      />
    </UFormField>
    <UFormField
      :label="t('auth.field.email')"
      :error="fieldErrors.email && t(fieldErrors.email, EXAMPLE)"
      name="email"
    >
      <UInput
        v-model="email"
        name="email"
        type="email"
        autocomplete="email"
        spellcheck="false"
        :disabled="busy"
        class="w-full"
      />
    </UFormField>
    <UFormField
      :label="t('auth.field.password')"
      :description="t('auth.field.passwordHint')"
      :error="fieldErrors.password && t(fieldErrors.password, EXAMPLE)"
      name="password"
    >
      <UInput
        v-model="password"
        name="password"
        :type="shown ? 'text' : 'password'"
        autocomplete="new-password"
        :disabled="busy"
        class="w-full"
        :ui="{ trailing: 'pe-1' }"
      >
        <template #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            :icon="shown ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            :aria-label="t('auth.field.showPassword')"
            :aria-pressed="shown ? 'true' : 'false'"
            @click="shown = !shown"
          />
        </template>
      </UInput>
    </UFormField>
    <UCheckbox
      v-model="demo"
      name="demo"
      :label="t('auth.setup.demo')"
      :description="t('auth.setup.demoHint')"
    />
    <p
      role="status"
      class="sr-only"
    >
      {{ announcement }}
    </p>
    <UButton
      type="submit"
      block
      :loading="busy"
      :aria-busy="busy ? 'true' : undefined"
    >
      {{ t('auth.setup.submit') }}
    </UButton>
  </form>
</template>
