<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';

/**
 * What an invitation link offers, and the next step: sign in with the invited account when signed out, accept with
 * it, or sign out from another one. Links create no accounts: whoever holds one could claim its email.
 */
const props = defineProps<{
  /** Null when the link is unknown, expired, used, or its inviter no longer vouches for it. */
  invitation: {
    workspace: string;
    role: WorkspaceRole;
    email: string;
    invitedBy: string | null;
    expiresAt: string;
  } | null;
  state: 'signedOut' | 'accept' | 'wrongAccount';
  signedInAs?: string | null;
  /** The sign-in page, returning to the invitation. */
  signInTo: string;
  busy?: boolean;
  /** An i18n key, said in an alert. */
  error?: string | null;
}>();
const emit = defineEmits<{ accept: []; signOut: [] }>();

const { t } = useI18n();

const offer = computed(() => {
  if (!props.invitation) {
    return '';
  }
  const { workspace, role, invitedBy } = props.invitation;
  const values = { workspace, role: t(`workspace.role.${role}`) };
  return invitedBy ? t('invitation.offer', { ...values, inviter: invitedBy }) : t('invitation.offerAnonymous', values);
});

const card = useTemplateRef<HTMLElement>('card');
const focus = async (selector: string) => {
  await nextTick();
  card.value?.querySelector<HTMLElement>(selector)?.focus();
};
// The control that had focus goes with the state it belonged to: focus moves to the next step's.
watch(() => props.state, () => focus('[data-next]'));
watch(() => props.error, (error) => error && focus('[role="alert"]'), { immediate: true });
</script>

<template>
  <div
    ref="card"
    class="flex flex-col gap-4"
  >
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
        tabindex="-1"
        color="error"
        variant="outline"
        :title="t(error)"
      />

      <template v-if="state === 'signedOut'">
        <p class="text-muted">
          {{ t('invitation.signInHint', { email: invitation.email }) }}
        </p>
        <UButton
          :to="signInTo"
          block
          data-next
        >
          {{ t('invitation.signIn') }}
        </UButton>
      </template>

      <template v-else-if="state === 'accept'">
        <p class="text-muted">
          {{ t('invitation.for', { email: invitation.email }) }}
        </p>
        <UButton
          block
          data-next
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
          data-next
          @click="emit('signOut')"
        >
          {{ t('invitation.signOut') }}
        </UButton>
      </template>
    </template>
  </div>
</template>
