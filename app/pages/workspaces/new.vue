<script setup lang="ts">
import type { MemberWorkspace } from '#shared/contracts/workspaces';

const { t } = useI18n();
const { session, signOut } = useAccount();
const { workspaces } = useWorkspaces();

useHead({ title: () => `${t('workspace.new.title')} · ${t('app.name')}` });

const canCreate = computed(() => session.value?.user.role === 'admin');
const busy = ref(false);
const error = ref<'taken' | 'network' | null>(null);
const toast = useToast();

const create = async (input: { name: string; slug: string }) => {
  busy.value = true;
  // Emptied first, so the same error twice is shown again.
  error.value = null;
  try {
    const created = await $fetch<MemberWorkspace>('/api/workspaces', { method: 'POST', body: input });
    await refreshNuxtData('workspaces');
    // A toast outlives this page: a status region here would go before it is read.
    toast.add({ title: t('workspace.new.created', { name: created.name }), color: 'success', icon: 'i-lucide-check' });
    await navigateTo(`/w/${created.slug}/graph`);
  } catch (failure) {
    await nextTick();
    error.value = (failure as { statusCode?: number }).statusCode === 409 ? 'taken' : 'network';
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <AppShell
    :user="session?.user"
    :workspaces="workspaces"
    :can-create="canCreate"
    @sign-out="signOut"
  >
    <h1 class="text-2xl font-semibold">
      {{ t('workspace.new.title') }}
    </h1>
    <WorkspaceForm
      v-if="canCreate"
      class="max-w-md"
      :busy="busy"
      :error="error"
      @submit="create"
    />
    <p
      v-else
      class="text-muted"
    >
      {{ t('workspace.new.forbidden') }}
    </p>
  </AppShell>
</template>
