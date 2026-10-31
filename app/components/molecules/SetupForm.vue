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

// The server's errors, on their fields, with focus on the first: when they come, and when the form appears with them.
const showServerErrors = (errors?: Partial<Record<Field, string>>) => {
  if (errors && Object.keys(errors).length > 0) {
    fieldErrors.value = { ...errors };
    void focusFirstError();
  }
};
watch(() => props.errors, showServerErrors);
onMounted(() => {
  showServerErrors(props.errors);
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
  // Fields stay focusable while busy (read-only, not disabled): a second press must not send twice.
  if (props.busy) {
    return;
  }
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
    <p class="text-sm text-muted">
      {{ t('auth.field.required') }}
    </p>
    <UFormField
      :label="t('auth.field.name')"
      :error="fieldErrors.name && t(fieldErrors.name, EXAMPLE)"
      name="name"
      required
    >
      <UInput
        v-model="name"
        name="name"
        autocomplete="name"
        required
        :readonly="busy"
        class="w-full"
      />
    </UFormField>
    <UFormField
      :label="t('auth.field.email')"
      :error="fieldErrors.email && t(fieldErrors.email, EXAMPLE)"
      name="email"
      required
    >
      <UInput
        v-model="email"
        name="email"
        type="email"
        autocomplete="email"
        required
        spellcheck="false"
        :readonly="busy"
        class="w-full"
      />
    </UFormField>
    <UFormField
      :label="t('auth.field.password')"
      :description="t('auth.field.passwordHint')"
      :error="fieldErrors.password && t(fieldErrors.password, EXAMPLE)"
      name="password"
      required
    >
      <UInput
        v-model="password"
        name="password"
        :type="shown ? 'text' : 'password'"
        autocomplete="new-password"
        required
        :readonly="busy"
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
      :icon="busy ? 'i-lucide-loader-circle' : undefined"
      :ui="{ leadingIcon: 'motion-safe:animate-spin' }"
      :aria-busy="busy ? 'true' : undefined"
    >
      {{ t('auth.setup.submit') }}
    </UButton>
  </form>
</template>
