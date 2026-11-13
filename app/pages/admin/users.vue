<script setup lang="ts">
import { FetchError } from 'ofetch';

import type { UserAccount } from '#shared/contracts/users';

const { t } = useI18n();
const { session, signOut } = useAccount();
const { workspaces } = useWorkspaces();
const isAdmin = computed(() => session.value?.user.role === 'admin');

useHead({ title: () => [t('users.title'), t('app.name')].join(' · ') });

const { data, error: loadError, refresh } = useFetch<{ users: UserAccount[] }>('/api/users', {
  server: false, immediate: false, watch: false,
});
// Only the administrator asks: anyone else is told what the page is for, without a refused request.
watch(isAdmin, (admin) => {
  if (admin) {
    void refresh();
  }
}, { immediate: true });

type TableError = { code: 'last_admin' | 'network' } | { code: 'last_owner'; name: string; workspaces: string[] };
const tableError = ref<TableError | null>(null);
const notice = ref('');
const table = useTemplateRef<{ focusHeading: () => void }>('table');
const nameOf = (userId: string) => data.value?.users.find((user) => user.id === userId)?.name ?? '';

/** The refusal a failed change answered, as the table says it. */
const refusalOf = (failure: unknown, userId: string): TableError => {
  const problem = failure instanceof FetchError ? failure.data as { code?: string; workspaces?: string[] } : undefined;
  if (problem?.code === 'last_owner') {
    return { code: 'last_owner', name: nameOf(userId), workspaces: problem.workspaces ?? [] };
  }
  return { code: problem?.code === 'last_admin' ? 'last_admin' : 'network' };
};

/** Sends a change, reads the accounts again and says what changed; a refusal is said above the table. */
const change = async (userId: string, request: () => Promise<unknown>, done: string, { removesRow = false } = {}) => {
  // Emptied first, so the same message twice is announced again.
  tableError.value = null;
  notice.value = '';
  try {
    await request();
  } catch (failure) {
    await refresh();
    await nextTick();
    tableError.value = refusalOf(failure, userId);
    return;
  }
  await refresh();
  notice.value = done;
  if (removesRow) {
    await nextTick();
    table.value?.focusHeading();
  }
};
const changeRole = (userId: string, role: UserAccount['role']) => change(
  userId,
  () => $fetch(`/api/users/${userId}`, { method: 'PATCH', body: { role } }),
  t('users.roleChanged', { name: nameOf(userId), role: t(`users.roleLabel.${role}`) }),
);
const remove = (userId: string) => change(
  userId,
  () => $fetch(`/api/users/${userId}`, { method: 'DELETE' }),
  t('users.removed', { name: nameOf(userId) }),
  { removesRow: true },
);

const creating = ref(false);
const createError = ref<'email_taken' | 'network' | null>(null);
const created = ref<{ email: string } | null>(null);
const create = async (account: { name: string; email: string; password: string }) => {
  creating.value = true;
  createError.value = null;
  created.value = null;
  try {
    const user = await $fetch<UserAccount>('/api/users', { method: 'POST', body: account });
    created.value = { email: user.email };
    await refresh();
  } catch (failure) {
    await nextTick();
    createError.value = failure instanceof FetchError && failure.status === 409 ? 'email_taken' : 'network';
  } finally {
    creating.value = false;
  }
};

const resetting = ref<string>();
const passwordOpen = ref(false);
const passwordBusy = ref(false);
const passwordDone = ref(false);
const passwordError = ref<'network' | null>(null);
const askPassword = (userId: string) => {
  resetting.value = userId;
  passwordDone.value = false;
  passwordError.value = null;
  // An earlier refusal is about another change.
  tableError.value = null;
  passwordOpen.value = true;
};
const setPassword = async (password: string) => {
  passwordBusy.value = true;
  passwordError.value = null;
  try {
    await $fetch(`/api/users/${resetting.value ?? ''}/password`, { method: 'PUT', body: { password } });
    passwordDone.value = true;
  } catch {
    await nextTick();
    passwordError.value = 'network';
  } finally {
    passwordBusy.value = false;
  }
};

const heading = useTemplateRef<HTMLElement>('heading');
const retry = async () => {
  await refresh();
  await nextTick();
  heading.value?.focus();
};
</script>

<template>
  <AppShell
    :user="session?.user"
    :workspaces="workspaces"
    :can-create="isAdmin"
    @sign-out="signOut"
  >
    <h1
      ref="heading"
      tabindex="-1"
      class="text-2xl font-semibold outline-none focus-visible:outline-2 focus-visible:outline-primary"
    >
      {{ t('users.title') }}
    </h1>

    <div
      v-if="session && !isAdmin"
      class="flex flex-col items-start gap-3 rounded-md border border-default p-6"
    >
      <p>{{ t('users.forAdmins') }}</p>
      <ULink
        to="/"
        class="text-primary underline"
      >
        {{ t('users.home') }}
      </ULink>
    </div>

    <div
      v-else-if="loadError"
      role="alert"
      class="flex flex-col items-start gap-3 rounded-md border border-error p-4"
    >
      <p>{{ t('users.error.load') }}</p>
      <UButton
        icon="i-lucide-refresh-cw"
        @click="retry"
      >
        {{ t('common.retry') }}
      </UButton>
    </div>

    <template v-else-if="data && session">
      <CreateUserForm
        :busy="creating"
        :error="createError"
        :created="created"
        @submit="create"
      />
      <p
        role="status"
        class="sr-only"
      >
        {{ notice }}
      </p>
      <UsersTable
        ref="table"
        :users="data.users"
        :me="session.user.id"
        :error="tableError"
        @change-role="changeRole"
        @remove="remove"
        @reset-password="askPassword"
      />
      <UserPasswordModal
        v-model:open="passwordOpen"
        :name="nameOf(resetting ?? '')"
        :busy="passwordBusy"
        :done="passwordDone"
        :error="passwordError"
        @submit="setPassword"
      />
    </template>

    <p
      v-else
      role="status"
      class="text-muted"
    >
      {{ t('users.loading') }}
    </p>
  </AppShell>
</template>
