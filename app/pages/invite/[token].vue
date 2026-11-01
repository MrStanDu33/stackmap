<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';

const { t } = useI18n();
const route = useRoute();
const { session, signOut } = useAccount();

const token = computed(() => String(route.params.token));
const { data: invitation } = useFetch<{
  workspace: string;
  role: WorkspaceRole;
  email: string;
  invitedBy: string | null;
  expiresAt: string;
}>(() => `/api/invitations/${token.value}`);

const title = computed(() => (invitation.value
  ? t('invitation.title', { workspace: invitation.value.workspace })
  : t('invitation.notFound')));
useHead({ title: () => `${title.value} · ${t('app.name')}` });

const state = computed(() => {
  if (!session.value) {
    return 'signedOut';
  }
  return session.value.user.email.toLowerCase() === invitation.value?.email ? 'accept' : 'wrongAccount';
});
const signInTo = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`);

const busy = ref(false);
const error = ref<string | null>(null);
/** Runs a request with the card busy; a failure is said in its alert. */
const send = async (request: () => Promise<void>) => {
  busy.value = true;
  error.value = null;
  try {
    await request();
  } catch {
    await nextTick();
    error.value = 'invitation.error';
  } finally {
    busy.value = false;
  }
};

const accept = () => send(async () => {
  const { slug } = await $fetch<{ slug: string }>(`/api/invitations/${token.value}/accept`, { method: 'POST' });
  await refreshNuxtData('workspaces');
  await navigateTo(`/w/${slug}/graph`);
});
</script>

<template>
  <AuthTemplate :title="title">
    <InvitationCard
      :invitation="invitation ?? null"
      :state="state"
      :signed-in-as="session?.user.email"
      :sign-in-to="signInTo"
      :busy="busy"
      :error="error"
      @accept="accept"
      @sign-out="signOut({ stay: true })"
    />
  </AuthTemplate>
</template>
