<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';

import { INVITATION_DAYS } from '#shared/contracts/invitations';

/** Invites someone by email with a role; once created, shows the link once, to copy and send. */
const props = defineProps<{
  /** The roles the caller may grant, lowest first. */
  roles: WorkspaceRole[];
  busy?: boolean;
  error?: 'already_member' | 'network' | null;
  /** The invitation just created: its full link and email. */
  created?: { url: string; email: string } | null;
}>();
const emit = defineEmits<{ submit: [invitation: { email: string; role: WorkspaceRole }] }>();

const { t } = useI18n();
const titleId = useId();
const email = ref('');
const role = ref<WorkspaceRole>('viewer');
const emailError = ref<string>();
const status = ref('');

const roleItems = computed(() => props.roles.map((value) => ({ label: t(`workspace.roleLabel.${value}`), value })));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A parameter: vue-i18n reads `@` in a message as a link to another message.
const EXAMPLE = { example: 'alan@homelab.example' };

const form = useTemplateRef<HTMLFormElement>('form');
const focusEmail = async () => {
  await nextTick();
  form.value?.querySelector<HTMLInputElement>('[name="email"]')?.focus();
};

watch(() => props.error, async (error) => {
  if (error === 'already_member') {
    emailError.value = t('invite.error.alreadyMember');
    await focusEmail();
  } else if (error === 'network') {
    await nextTick();
    form.value?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }
}, { immediate: true });

const linkField = useTemplateRef<HTMLElement>('link');
watch(() => props.created, async (created) => {
  if (!created) {
    return;
  }
  status.value = t('invite.created', { email: created.email });
  email.value = '';
  await nextTick();
  linkField.value?.querySelector('input')?.focus();
}, { immediate: true });

const submit = async () => {
  // Fields stay focusable while busy (read-only, not disabled): a second press must not send twice.
  if (props.busy) {
    return;
  }
  emailError.value = EMAIL.test(email.value.trim()) ? undefined : t('invite.error.email', EXAMPLE);
  if (emailError.value) {
    await focusEmail();
    return;
  }
  emit('submit', { email: email.value.trim(), role: role.value });
};

/** Copies the link; where the clipboard is not allowed, selects it so it can be copied by hand. */
const copy = async () => {
  if (!props.created) {
    return;
  }
  let said = 'invite.copied';
  try {
    await navigator.clipboard.writeText(props.created.url);
  } catch {
    // Selected and focused, to copy by hand; and said, since nothing else shows that the copy failed.
    const input = linkField.value?.querySelector('input');
    input?.focus();
    input?.select();
    said = 'invite.copyManual';
  }
  status.value = '';
  await nextTick();
  status.value = t(said);
};
</script>

<template>
  <form
    ref="form"
    class="flex flex-col gap-4"
    :aria-labelledby="titleId"
    novalidate
    @submit.prevent="submit"
  >
    <h2
      :id="titleId"
      class="text-lg font-semibold"
    >
      {{ t('invite.title') }}
    </h2>
    <UAlert
      v-if="error === 'network'"
      role="alert"
      tabindex="-1"
      color="error"
      variant="outline"
      :title="t('auth.error.network')"
    />
    <div class="flex flex-wrap items-end gap-3">
      <UFormField
        :label="t('invite.email')"
        :error="emailError"
        name="email"
        required
        class="min-w-64 flex-1"
      >
        <UInput
          v-model="email"
          name="email"
          type="email"
          autocomplete="off"
          spellcheck="false"
          required
          :readonly="busy"
          class="w-full"
        />
      </UFormField>
      <UFormField
        :label="t('invite.role')"
        name="role"
        required
      >
        <USelect
          v-model="role"
          :items="roleItems"
          class="min-w-40"
        />
      </UFormField>
      <UButton
        type="submit"
        :icon="busy ? 'i-lucide-loader-circle' : 'i-lucide-user-plus'"
        :ui="{ leadingIcon: busy ? 'motion-safe:animate-spin' : '' }"
        :aria-busy="busy ? 'true' : undefined"
      >
        {{ t('invite.submit') }}
      </UButton>
    </div>
    <div
      v-if="created"
      ref="link"
      class="flex flex-wrap items-end gap-3"
    >
      <UFormField
        :label="t('invite.link')"
        :description="t('invite.linkHint', { email: created.email, days: INVITATION_DAYS })"
        name="link"
        class="min-w-64 flex-1"
      >
        <UInput
          :model-value="created.url"
          name="link"
          readonly
          class="w-full"
        />
      </UFormField>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-copy"
        @click="copy"
      >
        {{ t('invite.copy') }}
      </UButton>
    </div>
    <p
      role="status"
      class="sr-only"
    >
      {{ status }}
    </p>
  </form>
</template>
