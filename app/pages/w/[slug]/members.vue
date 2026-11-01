<script setup lang="ts">
import { FetchError } from 'ofetch';

import type { WorkspaceRole } from '#shared/contracts/contract';
import type { Member, PendingInvitation } from '#shared/contracts/members';

import { WORKSPACE_ROLES } from '#shared/contracts/contract';

const { t } = useI18n();
const { session, signOut } = useAccount();
const route = useRoute();

const { workspaces, error: workspaceError, refresh: refreshWorkspaces } = useWorkspaces();
const workspace = computed(() => workspaces.value?.find(({ slug }) => slug === route.params.slug));
const noWorkspace = computed(() => workspaces.value?.length === 0);
const notFound = computed(() => Boolean(workspaces.value?.length) && !workspace.value);
const canCreate = computed(() => session.value?.user.role === 'admin');

useHead({
  title: () => (notFound.value
    ? [t('workspace.notFound'), t('app.name')]
    : [t('members.title'), workspace.value?.name, t('app.name')]).filter(Boolean).join(' · '),
});

const membersUrl = computed(() => (workspace.value ? `/api/workspaces/${workspace.value.id}/members` : ''));
const { data, error: membersError, refresh } = useFetch<{ members: Member[]; invitations?: PendingInvitation[] }>(
  membersUrl,
  { server: false, immediate: false, watch: false },
);
watch(membersUrl, (url) => {
  if (url) {
    void refresh();
  }
}, { immediate: true });

const myRole = computed(() => workspace.value?.role ?? 'viewer');
// Admins grant editor and viewer; owners every role.
const grantable = computed<WorkspaceRole[]>(() => {
  if (myRole.value === 'owner') {
    return [...WORKSPACE_ROLES];
  }
  return myRole.value === 'admin' ? ['viewer', 'editor'] : [];
});

const tableError = ref<'last_owner' | 'network' | null>(null);
const notice = ref('');
const table = useTemplateRef<{ focusHeading: () => void }>('table');
const statusOf = (failure: unknown) => (failure instanceof FetchError ? failure.status : undefined);

/**
 * Sends a change, then reads the members again and says what changed; a refusal is said above the table. When the
 * change removed the row (or the list) that had the focus, the focus goes to the members' heading.
 */
const change = async (request: () => Promise<unknown>, done: string, { removesRow = false } = {}) => {
  // Emptied first, so the same message twice is announced again.
  tableError.value = null;
  notice.value = '';
  try {
    await request();
    await refresh();
  } catch (failure) {
    await nextTick();
    tableError.value = statusOf(failure) === 409 ? 'last_owner' : 'network';
    return false;
  }
  notice.value = done;
  if (removesRow) {
    await nextTick();
    table.value?.focusHeading();
  }
  return true;
};
const base = computed(() => `/api/workspaces/${workspace.value?.id ?? ''}`);
const nameOf = (userId: string) => data.value?.members.find((member) => member.userId === userId)?.name ?? '';
const changeRole = (userId: string, role: WorkspaceRole) => change(
  () => $fetch(`${base.value}/members/${userId}`, { method: 'PATCH', body: { role } }),
  t('members.roleChanged', { name: nameOf(userId), role: t(`workspace.role.${role}`) }),
);
const remove = async (userId: string) => {
  const name = nameOf(userId);
  const removed = await change(() => $fetch(`${base.value}/members/${userId}`, { method: 'DELETE' }), t('members.removed', { name }), { removesRow: true });
  // Left: the workspace is no longer theirs.
  if (removed && userId === session.value?.user.id) {
    await refreshNuxtData('workspaces');
    await navigateTo('/graph');
  }
};
const revoke = (invitationId: string) => change(
  () => $fetch(`${base.value}/invitations/${invitationId}`, { method: 'DELETE' }),
  t('members.revoked'),
  { removesRow: true },
);

const inviting = ref(false);
const inviteError = ref<'already_member' | 'network' | null>(null);
const created = ref<{ url: string; email: string } | null>(null);
const invite = async (invitation: { email: string; role: WorkspaceRole }) => {
  inviting.value = true;
  inviteError.value = null;
  try {
    const { url } = await $fetch<{ url: string }>(`${base.value}/invitations`, { method: 'POST', body: invitation });
    created.value = { url: `${window.location.origin}${url}`, email: invitation.email.trim().toLowerCase() };
    await refresh();
  } catch (failure) {
    await nextTick();
    inviteError.value = statusOf(failure) === 409 ? 'already_member' : 'network';
  } finally {
    inviting.value = false;
  }
};

const heading = useTemplateRef<HTMLElement>('heading');
const retry = async () => {
  await refreshWorkspaces();
  if (membersUrl.value) {
    await refresh();
  }
  await nextTick();
  heading.value?.focus();
};
</script>

<template>
  <AppShell
    :user="session?.user"
    :workspaces="workspaces"
    :current="workspace?.slug"
    :can-create="canCreate"
    @sign-out="signOut"
  >
    <h1
      ref="heading"
      tabindex="-1"
      class="text-2xl font-semibold outline-none focus-visible:outline-2 focus-visible:outline-primary"
    >
      {{ t('members.title') }}
    </h1>

    <div
      v-if="workspaceError || membersError"
      role="alert"
      class="flex flex-col items-start gap-3 rounded-md border border-error p-4"
    >
      <p>{{ t('members.error') }}</p>
      <UButton
        icon="i-lucide-refresh-cw"
        @click="retry"
      >
        {{ t('common.retry') }}
      </UButton>
    </div>

    <NoWorkspace
      v-else-if="noWorkspace"
      :can-create="canCreate"
    />

    <div
      v-else-if="notFound"
      class="flex flex-col items-start gap-2 rounded-md border border-default p-6"
    >
      <h2 class="text-lg font-semibold">
        {{ t('workspace.notFound') }}
      </h2>
      <p class="text-muted">
        {{ t('workspace.notFoundHint') }}
      </p>
    </div>

    <template v-else-if="data && session">
      <InviteForm
        v-if="grantable.length > 0"
        :roles="grantable"
        :busy="inviting"
        :error="inviteError"
        :created="created"
        @submit="invite"
      />
      <p
        role="status"
        class="sr-only"
      >
        {{ notice }}
      </p>
      <MembersTable
        ref="table"
        :members="data.members"
        :invitations="data.invitations"
        :me="session.user.id"
        :my-role="myRole"
        :error="tableError"
        @change-role="changeRole"
        @remove="remove"
        @revoke="revoke"
      />
    </template>

    <p
      v-else
      role="status"
      class="text-muted"
    >
      {{ t('members.loading') }}
    </p>
  </AppShell>
</template>
