<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';
import type { Member, PendingInvitation } from '#shared/contracts/members';

import { WORKSPACE_ROLES } from '#shared/contracts/contract';

/**
 * A workspace's members and pending invitations, with the controls the caller's role allows: admins manage editors
 * and viewers, owners everyone, and every member may leave. The server applies the same rules.
 */
const props = defineProps<{
  members: Member[];
  /** For admins and owners only. */
  invitations?: PendingInvitation[];
  /** The caller's account id. */
  me: string;
  myRole: WorkspaceRole;
  error?: 'last_owner' | 'network' | null;
}>();
const emit = defineEmits<{
  changeRole: [userId: string, role: WorkspaceRole];
  remove: [userId: string];
  revoke: [invitationId: string];
}>();

const { t, locale } = useI18n();
const membersTitle = useId();
const invitationsTitle = useId();

// The day and the time: an invitation can run out late in the day.
const expiry = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

const MANAGED_BY_ADMINS: readonly WorkspaceRole[] = ['viewer', 'editor'];
const grantable = computed<readonly WorkspaceRole[]>(() => {
  if (props.myRole === 'owner') {
    return WORKSPACE_ROLES;
  }
  return props.myRole === 'admin' ? MANAGED_BY_ADMINS : [];
});
const manages = (member: Member) => member.userId !== props.me && grantable.value.includes(member.role);
const roleItems = computed(() => grantable.value.map((value) => ({ label: t(`workspace.roleLabel.${value}`), value })));

/** The action waiting for confirmation, and its words: kept while the dialog closes, so it keeps its name. */
const pending = ref<{ question: string; action: string; confirm: () => void }>();
const confirmOpen = ref(false);
const wasConfirmed = ref(false);
const ask = (question: string, action: string, confirm: () => void) => {
  pending.value = { question, action, confirm };
  wasConfirmed.value = false;
  confirmOpen.value = true;
};
const confirmed = () => {
  wasConfirmed.value = true;
  confirmOpen.value = false;
  pending.value?.confirm();
};
/**
 * Cancelled, focus returns to the button that opened the dialog. Confirmed, that button may be going away with its
 * row, and the outcome (the members' heading, or an alert) takes the focus instead.
 */
const onCloseAutoFocus = (event: Event) => {
  if (wasConfirmed.value) {
    event.preventDefault();
  }
};

const askRemove = (member: Member) => {
  if (member.userId === props.me) {
    ask(t('members.leaveQuestion'), t('members.leave'), () => {
      emit('remove', member.userId);
    });
  } else {
    ask(t('members.removeQuestion', { name: member.name }), t('members.remove', { name: member.name }), () => {
      emit('remove', member.userId);
    });
  }
};
const root = useTemplateRef<HTMLElement>('root');
// A refusal takes the focus, so it is read where the reader is.
watch(() => props.error, async (error) => {
  if (error) {
    await nextTick();
    root.value?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }
}, { immediate: true });

defineExpose({
  /** Focuses the members' heading: after a change removed the row, or the list, that had the focus. */
  focusHeading: () => {
    root.value?.querySelector<HTMLElement>(`[id="${membersTitle}"]`)?.focus();
  },
});

const askRevoke = (invitation: PendingInvitation) => {
  ask(t('members.revokeQuestion', { email: invitation.email }), t('members.revokeConfirm'), () => {
    emit('revoke', invitation.id);
  });
};
</script>

<template>
  <div
    ref="root"
    class="flex flex-col gap-6"
  >
    <UAlert
      v-if="error"
      role="alert"
      tabindex="-1"
      color="error"
      variant="outline"
      :title="t(error === 'last_owner' ? 'members.lastOwner' : 'members.changeError')"
    />

    <section class="flex flex-col gap-2">
      <h2
        :id="membersTitle"
        tabindex="-1"
        class="text-lg font-semibold outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        {{ t('members.title') }}
      </h2>
      <div class="overflow-x-auto">
        <table
          class="w-full text-start text-sm"
          :aria-labelledby="membersTitle"
        >
          <thead>
            <tr class="border-b border-default">
              <th
                scope="col"
                class="p-2 text-start"
              >
                {{ t('members.name') }}
              </th>
              <th
                scope="col"
                class="p-2 text-start"
              >
                {{ t('members.email') }}
              </th>
              <th
                scope="col"
                class="p-2 text-start"
              >
                {{ t('members.role') }}
              </th>
              <th
                scope="col"
                class="p-2 text-start"
              >
                {{ t('members.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="member in members"
              :key="member.userId"
              class="border-b border-default"
            >
              <th
                scope="row"
                class="p-2 text-start font-medium"
              >
                {{ member.name }}
                <span
                  v-if="member.userId === me"
                  class="text-muted"
                >{{ t('members.you') }}</span>
              </th>
              <td class="p-2">
                {{ member.email }}
              </td>
              <td class="p-2">
                <USelect
                  v-if="manages(member)"
                  :model-value="member.role"
                  :items="roleItems"
                  :aria-label="t('members.roleOf', { name: member.name })"
                  class="min-w-36"
                  @update:model-value="emit('changeRole', member.userId, $event as WorkspaceRole)"
                />
                <span v-else>{{ t(`workspace.roleLabel.${member.role}`) }}</span>
              </td>
              <td class="p-2">
                <UButton
                  v-if="member.userId === me"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-log-out"
                  @click="askRemove(member)"
                >
                  {{ t('members.leave') }}
                </UButton>
                <UButton
                  v-else-if="manages(member)"
                  color="error"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-user-minus"
                  :aria-label="t('members.remove', { name: member.name })"
                  @click="askRemove(member)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-if="invitations?.length"
      class="flex flex-col gap-2"
    >
      <h2
        :id="invitationsTitle"
        class="text-lg font-semibold"
      >
        {{ t('members.invitations') }}
      </h2>
      <div class="overflow-x-auto">
        <table
          class="w-full text-start text-sm"
          :aria-labelledby="invitationsTitle"
        >
          <thead>
            <tr class="border-b border-default">
              <th
                scope="col"
                class="p-2 text-start"
              >
                {{ t('members.email') }}
              </th>
              <th
                scope="col"
                class="p-2 text-start"
              >
                {{ t('members.role') }}
              </th>
              <th
                scope="col"
                class="p-2 text-start"
              >
                {{ t('members.invitedBy') }}
              </th>
              <th
                scope="col"
                class="p-2 text-start"
              >
                {{ t('members.expires') }}
              </th>
              <th
                scope="col"
                class="p-2 text-start"
              >
                {{ t('members.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="invitation in invitations"
              :key="invitation.id"
              class="border-b border-default"
            >
              <th
                scope="row"
                class="p-2 text-start font-medium"
              >
                {{ invitation.email }}
              </th>
              <td class="p-2">
                {{ t(`workspace.roleLabel.${invitation.role}`) }}
              </td>
              <td class="p-2">
                {{ invitation.invitedBy ?? t('members.invitedByDeleted') }}
              </td>
              <td class="p-2">
                <time :datetime="invitation.expiresAt">{{ expiry(invitation.expiresAt) }}</time>
              </td>
              <td class="p-2">
                <UButton
                  v-if="grantable.includes(invitation.role)"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-x"
                  :aria-label="t('members.revoke', { email: invitation.email })"
                  @click="askRevoke(invitation)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <UModal
      v-model:open="confirmOpen"
      :content="{ onCloseAutoFocus }"
      :title="pending?.action ?? ''"
      :description="pending?.question ?? ''"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            @click="confirmOpen = false"
          >
            {{ t('members.cancel') }}
          </UButton>
          <UButton
            color="error"
            @click="confirmed"
          >
            {{ pending?.action }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
