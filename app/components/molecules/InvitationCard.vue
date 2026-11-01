<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';

import { MIN_PASSWORD } from '#shared/contracts/auth';

/**
 * What an invitation link offers, and the next step: create an account or sign in when signed out, accept with the
 * invited account, or sign out from another one. Nothing here tells whether the invited email has an account.
 */
const props = defineProps<{
  /** Null when the link is unknown, expired or used. */
  invitation: {
    workspace: string;
    role: WorkspaceRole;
    email: string;
    invitedBy: string | null;
    expiresAt: string;
  } | null;
  state: 'signedOut' | 'registered' | 'accept' | 'wrongAccount';
  signedInAs?: string | null;
  /** The sign-in page, returning to the invitation. */
  signInTo: string;
  busy?: boolean;
  /** An i18n key, said in an alert. */
  error?: string | null;
}>();
const emit = defineEmits<{ register: [account: { name: string; password: string }]; accept: []; signOut: [] }>();

const { t } = useI18n();
const name = ref('');
const password = ref('');
const fieldErrors = ref<{ name?: string; password?: string }>({});
const status = ref('');

const offer = computed(() => {
  if (!props.invitation) {
    return '';
  }
  const { workspace, role, invitedBy } = props.invitation;
  const values = { workspace, role: t(`workspace.role.${role}`) };
  return invitedBy ? t('invitation.offer', { ...values, inviter: invitedBy }) : t('invitation.offerAnonymous', values);
});

// Said when it happens, so it is heard.
watch(() => props.state, async (state) => {
  status.value = '';
  if (state === 'registered' && props.invitation) {
    await nextTick();
    status.value = t('invitation.registered', { email: props.invitation.email });
  }
}, { immediate: true });

const form = useTemplateRef<HTMLFormElement>('form');
const register = async () => {
  if (props.busy) {
    return;
  }
  fieldErrors.value = {
    ...(name.value.trim() ? {} : { name: t('auth.error.name') }),
    ...(password.value.length >= MIN_PASSWORD ? {} : { password: t('auth.error.password') }),
  };
  const first = (['name', 'password'] as const).find((field) => fieldErrors.value[field]);
  if (first) {
    await nextTick();
    form.value?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
    return;
  }
  emit('register', { name: name.value.trim(), password: password.value });
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <p
      v-if="!invitation"
      class="text-muted"
    >
      {{ t('invitation.notFoundHint') }}
    </p>
    <template v-else>
      <p>{{ offer }}</p>
      <UAlert
        v-if="error"
        role="alert"
        color="error"
        variant="outline"
        :title="t(error)"
      />

      <template v-if="state === 'signedOut'">
        <form
          ref="form"
          class="flex flex-col gap-4"
          novalidate
          @submit.prevent="register"
        >
          <h2 class="font-semibold">
            {{ t('invitation.newAccount') }}
          </h2>
          <UFormField
            :label="t('auth.field.email')"
            name="email"
          >
            <UInput
              :model-value="invitation.email"
              name="email"
              type="email"
              readonly
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('auth.field.name')"
            :error="fieldErrors.name"
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
            :label="t('auth.field.password')"
            :description="t('auth.field.passwordHint')"
            :error="fieldErrors.password"
            name="password"
            required
          >
            <UInput
              v-model="password"
              name="password"
              type="password"
              autocomplete="new-password"
              required
              :readonly="busy"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            block
            :aria-busy="busy ? 'true' : undefined"
          >
            {{ t('invitation.register') }}
          </UButton>
        </form>
        <div class="flex flex-col gap-2 border-t border-default pt-4">
          <h2 class="font-semibold">
            {{ t('invitation.haveAccount') }}
          </h2>
          <UButton
            :to="signInTo"
            color="neutral"
            variant="outline"
            block
          >
            {{ t('invitation.signIn') }}
          </UButton>
        </div>
      </template>

      <UButton
        v-else-if="state === 'registered'"
        :to="signInTo"
        block
      >
        {{ t('invitation.signIn') }}
      </UButton>

      <template v-else-if="state === 'accept'">
        <p class="text-muted">
          {{ t('invitation.for', { email: invitation.email }) }}
        </p>
        <UButton
          block
          :aria-busy="busy ? 'true' : undefined"
          @click="!busy && emit('accept')"
        >
          {{ t('invitation.accept') }}
        </UButton>
      </template>

      <template v-else>
        <p>{{ t('invitation.wrongAccount', { email: signedInAs ?? '', invited: invitation.email }) }}</p>
        <UButton
          color="neutral"
          variant="outline"
          block
          @click="emit('signOut')"
        >
          {{ t('invitation.signOut') }}
        </UButton>
      </template>
    </template>
    <p
      role="status"
      class="sr-only"
    >
      {{ status }}
    </p>
  </div>
</template>
