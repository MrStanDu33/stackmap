<script setup lang="ts">
import { MIN_PASSWORD } from '#shared/contracts/auth';

/** Asks for another account's new temporary password; once set, says it was signed out everywhere. */
const props = defineProps<{
  open: boolean;
  /** The account's name. */
  name: string;
  busy?: boolean;
  /** The password was set. */
  done?: boolean;
  /** Setting it failed. */
  error?: 'network' | null;
}>();
const emit = defineEmits<{ submit: [password: string]; 'update:open': [open: boolean] }>();

const { t } = useI18n();
const password = ref('');
const fieldError = ref<string>();
const form = useTemplateRef<HTMLFormElement>('form');

const field = () => form.value?.querySelector<HTMLInputElement>('[name="password"]');
// The field the dialog is for, rather than its close button.
const onOpenAutoFocus = (event: Event) => {
  event.preventDefault();
  void nextTick(() => field()?.focus());
};

watch(() => props.open, (open) => {
  if (open) {
    password.value = '';
    fieldError.value = undefined;
  }
});

const submit = async () => {
  if (props.busy) {
    return;
  }
  fieldError.value = password.value.length >= MIN_PASSWORD ? undefined : t('auth.error.password');
  if (fieldError.value) {
    await nextTick();
    field()?.focus();
    return;
  }
  emit('submit', password.value);
};
</script>

<template>
  <UModal
    :open="open"
    :title="t('users.newPasswordFor', { name })"
    :content="{ onOpenAutoFocus }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form
        ref="form"
        class="flex flex-col gap-4"
        novalidate
        @submit.prevent="submit"
      >
        <UFormField
          :label="t('users.temporaryPassword')"
          :description="t('users.passwordRule')"
          :error="fieldError"
          name="password"
          required
        >
          <UInput
            v-model="password"
            name="password"
            type="password"
            autocomplete="new-password"
            required
            :readonly="busy || done"
            class="w-full"
          />
        </UFormField>
        <p
          role="status"
          class="text-sm"
        >
          {{ done ? t('users.passwordSet', { name }) : '' }}
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            @click="emit('update:open', false)"
          >
            {{ t(done ? 'users.close' : 'users.cancel') }}
          </UButton>
          <UButton
            v-if="!done"
            type="submit"
            :icon="busy ? 'i-lucide-loader-circle' : undefined"
            :ui="{ leadingIcon: 'motion-safe:animate-spin' }"
            :aria-busy="busy ? 'true' : undefined"
          >
            {{ t('users.setPassword') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
