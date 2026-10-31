<script setup lang="ts">
/** Signing in with an email and password; what went wrong with the last attempt, if anything. */
const props = defineProps<{
  busy?: boolean;
  error?: 'invalid' | 'throttled' | 'network' | null;
  /** Seconds to wait, with `throttled`. */
  retryAfter?: number | null;
}>();
const emit = defineEmits<{ submit: [credentials: { email: string; password: string }] }>();

const { t } = useI18n();
const email = ref('');
const password = ref('');
const shown = ref(false);

const message = computed(() => {
  if (props.error === 'invalid') {
    return t('auth.login.invalid');
  }
  if (props.error === 'throttled') {
    const seconds = props.retryAfter ?? 60;
    return t('auth.login.throttled', { seconds }, seconds);
  }
  return props.error === 'network' ? t('auth.error.network') : '';
});

const form = useTemplateRef<HTMLFormElement>('form');
// After a failure, focus goes where to try again: the password when it was wrong, the email otherwise.
watch(() => props.error, async (error) => {
  if (error) {
    await nextTick();
    form.value?.querySelector<HTMLInputElement>(`[name="${error === 'invalid' ? 'password' : 'email'}"]`)?.focus();
  }
});

const submit = () => {
  // Fields stay focusable while busy (read-only, not disabled): a second press must not send twice.
  if (!props.busy) {
    emit('submit', { email: email.value.trim(), password: password.value });
  }
};
</script>

<template>
  <form
    ref="form"
    class="flex flex-col gap-4"
    @submit.prevent="submit"
  >
    <!-- An alert is read when it appears, unlike the other live regions. -->
    <UAlert
      v-if="message"
      role="alert"
      color="error"
      variant="outline"
      icon="i-lucide-circle-alert"
      :title="message"
    />
    <UFormField
      :label="t('auth.field.email')"
      name="email"
    >
      <UInput
        v-model="email"
        name="email"
        type="email"
        autocomplete="username"
        spellcheck="false"
        required
        :readonly="busy"
        class="w-full"
      />
    </UFormField>
    <UFormField
      :label="t('auth.field.password')"
      name="password"
    >
      <UInput
        v-model="password"
        name="password"
        :type="shown ? 'text' : 'password'"
        autocomplete="current-password"
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
    <UButton
      type="submit"
      block
      :icon="busy ? 'i-lucide-loader-circle' : undefined"
      :ui="{ leadingIcon: 'motion-safe:animate-spin' }"
      :aria-busy="busy ? 'true' : undefined"
    >
      {{ t('auth.login.submit') }}
    </UButton>
  </form>
</template>
