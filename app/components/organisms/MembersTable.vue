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

const { t, d } = useI18n();

const MANAGED_BY_ADMINS: readonly WorkspaceRole[] = ['viewer', 'editor'];
const grantable = computed<readonly WorkspaceRole[]>(() => {
  if (props.myRole === 'owner') {
    return WORKSPACE_ROLES;
  }
  return props.myRole === 'admin' ? MANAGED_BY_ADMINS : [];
});
const manages = (member: Member) => member.userId !== props.me && grantable.value.includes(member.role);
const roleItems = computed(() => grantable.value.map((value) => ({ label: t(`workspace.role.${value}`), value })));

/** The action waiting for confirmation, and its words: kept while the dialog closes, so it keeps its name. */
const pending = ref<{ question: string; action: string; confirm: () => void }>();
const confirmOpen = ref(false);
const ask = (question: string, action: string, confirm: () => void) => {
  pending.value = { question, action, confirm };
  confirmOpen.value = true;
};
const confirmed = () => {
  confirmOpen.value = false;
  pending.value?.confirm();
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
const askRevoke = (invitation: PendingInvitation) => {
  ask(t('members.revokeQuestion', { email: invitation.email }), t('members.revokeConfirm'), () => {
    emit('revoke', invitation.id);
  });
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <UAlert
      v-if="error"
      role="alert"
      color="error"
      variant="outline"
      :title="t(error === 'last_owner' ? 'members.lastOwner' : 'members.changeError')"
    />

    <div class="overflow-x-auto">
      <table class="w-full text-start text-sm">
        <caption class="mb-2 text-start text-lg font-semibold">
          {{ t('members.title') }}
        </caption>
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
              <span v-else>{{ t(`workspace.role.${member.role}`) }}</span>
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

    <div
      v-if="invitations?.length"
      class="overflow-x-auto"
    >
      <table class="w-full text-start text-sm">
        <caption class="mb-2 text-start text-lg font-semibold">
          {{ t('members.invitations') }}
        </caption>
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
              {{ t(`workspace.role.${invitation.role}`) }}
            </td>
            <td class="p-2">
              {{ invitation.invitedBy ?? '—' }}
            </td>
            <td class="p-2">
              <time :datetime="invitation.expiresAt">{{ d(new Date(invitation.expiresAt)) }}</time>
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

    <UModal
      v-model:open="confirmOpen"
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
