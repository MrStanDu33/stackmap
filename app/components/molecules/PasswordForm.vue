<script setup lang="ts">
import { MIN_PASSWORD } from '#shared/contracts/auth';

type Field = 'current' | 'next' | 'confirm';

/**
 * Changes the password: the current one, the new one twice. Checks what it can before sending (length, different,
 * confirmed); the server's refusals come back through `error`.
 */
const props = defineProps<{
  busy?: boolean;
  error?: 'wrong_password' | 'throttled' | 'network' | null;
  /** Seconds to wait, for `throttled`. */
  retryAfter?: number | null;
  /** The password was changed. */
  done?: boolean;
}>();
const emit = defineEmits<{ submit: [change: { currentPassword: string; newPassword: string }] }>();

const { t } = useI18n();
const titleId = useId();
const values = reactive<Record<Field, string>>({ current: '', next: '', confirm: '' });
const fieldErrors = ref<Partial<Record<Field, string>>>({});
const shown = reactive<Record<Field, boolean>>({ current: false, next: false, confirm: false });
const form = useTemplateRef<HTMLFormElement>('form');

const focus = async (selector: string) => {
  await nextTick();
  form.value?.querySelector<HTMLElement>(selector)?.focus();
};
const focusFirstError = () => {
  const first = (['current', 'next', 'confirm'] as const).find((field) => fieldErrors.value[field]);
  return first ? focus(`[name="${first}"]`) : Promise.resolve();
};

watch(() => props.error, async (error) => {
  if (error === 'wrong_password') {
    fieldErrors.value = { current: t('settings.error.wrongPassword') };
    await focusFirstError();
  } else if (error) {
    await focus('[role="alert"]');
  }
}, { immediate: true });

watch(() => props.done, (done) => {
  if (done) {
    Object.assign(values, { current: '', next: '', confirm: '' });
  }
}, { immediate: true });

const alertText = computed(() => (props.error === 'throttled'
  ? t('auth.login.throttled', { seconds: props.retryAfter ?? 60 }, props.retryAfter ?? 60)
  : t('auth.error.network')));

const submit = async () => {
  // Fields stay focusable while busy (read-only, not disabled): a second press must not send twice.
  if (props.busy) {
    return;
  }
  const tooShort = values.next.length < MIN_PASSWORD;
  fieldErrors.value = {
    ...(values.current ? {} : { current: t('settings.error.currentRequired') }),
    ...(tooShort ? { next: t('auth.error.password') } : {}),
    ...(!tooShort && values.next === values.current ? { next: t('settings.error.same') } : {}),
    ...(values.confirm === values.next ? {} : { confirm: t('settings.error.confirmation') }),
  };
  if (Object.keys(fieldErrors.value).length > 0) {
    await focusFirstError();
    return;
  }
  emit('submit', { currentPassword: values.current, newPassword: values.next });
};

const fields = computed(() => [
  { name: 'current' as const, label: t('settings.currentPassword'), autocomplete: 'current-password', description: undefined },
  { name: 'next' as const, label: t('settings.newPassword'), autocomplete: 'new-password', description: t('settings.passwordRule') },
  { name: 'confirm' as const, label: t('settings.confirmPassword'), autocomplete: 'new-password', description: undefined },
]);
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
      {{ t('settings.password') }}
    </h2>
    <form
      ref="form"
      class="flex flex-col gap-4"
      novalidate
      @submit.prevent="submit"
    >
      <UAlert
        v-if="error === 'throttled' || error === 'network'"
        role="alert"
        tabindex="-1"
        color="error"
        variant="outline"
        :title="alertText"
      />
      <UFormField
        v-for="field in fields"
        :key="field.name"
        :label="field.label"
        :description="field.description"
        :error="fieldErrors[field.name]"
        :name="field.name"
        required
      >
        <UInput
          v-model="values[field.name]"
          :name="field.name"
          :type="shown[field.name] ? 'text' : 'password'"
          :autocomplete="field.autocomplete"
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
              :icon="shown[field.name] ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="t(`settings.show.${field.name}`)"
              :aria-pressed="shown[field.name] ? 'true' : 'false'"
              @click="shown[field.name] = !shown[field.name]"
            />
          </template>
        </UInput>
      </UFormField>
      <p
        role="status"
        class="text-sm"
      >
        {{ done ? t('settings.passwordChanged') : '' }}
      </p>
      <UButton
        type="submit"
        class="self-start"
        :icon="busy ? 'i-lucide-loader-circle' : 'i-lucide-key-round'"
        :ui="{ leadingIcon: busy ? 'motion-safe:animate-spin' : '' }"
        :aria-busy="busy ? 'true' : undefined"
      >
        {{ t('settings.changePassword') }}
      </UButton>
    </form>
  </section>
</template>
