<script setup lang="ts">
import { MIN_PASSWORD } from '#shared/contracts/auth';

type Field = 'name' | 'email' | 'password';

/** Creates an account with a temporary password the administrator chooses and sends to the person themselves. */
const props = defineProps<{
  busy?: boolean;
  error?: 'email_taken' | 'network' | null;
  /** The account just created. */
  created?: { email: string } | null;
}>();
const emit = defineEmits<{ submit: [account: { name: string; email: string; password: string }] }>();

const { t } = useI18n();
const titleId = useId();
const name = ref('');
const email = ref('');
const password = ref('');
const shown = ref(false);
const fieldErrors = ref<Partial<Record<Field, string>>>({});
const status = ref('');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A parameter: vue-i18n reads `@` in a message as a link to another message.
const EXAMPLE = { example: 'grace@homelab.example' };

const form = useTemplateRef<HTMLFormElement>('form');
const focusFirstError = async () => {
  const first = (['name', 'email', 'password'] as const).find((field) => fieldErrors.value[field]);
  await nextTick();
  if (first) {
    form.value?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
  }
};

watch(() => props.error, async (error) => {
  if (error === 'email_taken') {
    fieldErrors.value = { email: 'users.error.emailTaken' };
    await focusFirstError();
  } else if (error === 'network') {
    await nextTick();
    form.value?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }
}, { immediate: true });

watch(() => props.created, (created) => {
  if (created) {
    status.value = t('users.created', { email: created.email });
    name.value = '';
    email.value = '';
    password.value = '';
  }
}, { immediate: true });

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
  if (Object.keys(fieldErrors.value).length > 0) {
    await focusFirstError();
    return;
  }
  status.value = '';
  emit('submit', { name: name.value.trim(), email: email.value.trim(), password: password.value });
};
</script>

<template>
  <section
    class="flex flex-col gap-4"
    :aria-labelledby="titleId"
  >
    <h2
      :id="titleId"
      class="text-lg font-semibold"
    >
      {{ t('users.createTitle') }}
    </h2>
    <form
      ref="form"
      class="flex flex-col gap-4"
      novalidate
      @submit.prevent="submit"
    >
      <UAlert
        v-if="error === 'network'"
        role="alert"
        tabindex="-1"
        color="error"
        variant="outline"
        :title="t('auth.error.network')"
      />
      <UFormField
        :label="t('users.name')"
        :error="fieldErrors.name && t(fieldErrors.name)"
        name="name"
        required
      >
        <UInput
          v-model="name"
          name="name"
          autocomplete="off"
          required
          :readonly="busy"
          class="w-full"
        />
      </UFormField>
      <UFormField
        :label="t('users.email')"
        :error="fieldErrors.email && t(fieldErrors.email, EXAMPLE)"
        name="email"
        required
      >
        <UInput
          v-model="email"
          name="email"
          type="email"
          autocomplete="off"
          required
          spellcheck="false"
          :readonly="busy"
          class="w-full"
        />
      </UFormField>
      <UFormField
        :label="t('users.temporaryPassword')"
        :description="t('users.passwordRule')"
        :error="fieldErrors.password && t(fieldErrors.password)"
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
      <p
        role="status"
        class="text-sm"
      >
        {{ status }}
      </p>
      <UButton
        type="submit"
        class="self-start"
        :icon="busy ? 'i-lucide-loader-circle' : 'i-lucide-user-plus'"
        :ui="{ leadingIcon: busy ? 'motion-safe:animate-spin' : '' }"
        :aria-busy="busy ? 'true' : undefined"
      >
        {{ t('users.create') }}
      </UButton>
    </form>
  </section>
</template>
