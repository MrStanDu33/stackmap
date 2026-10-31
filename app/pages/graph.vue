<script setup lang="ts">
import { workspaceRedirect } from '~/utils/workspace-redirect';

// `/graph` and `/trace` lead to the same view of the last workspace opened, or the first one; without any, the page
// says how to get one.
definePageMeta({ alias: ['/trace'] });

const { t } = useI18n();
const { session, signOut } = useAccount();
const route = useRoute();
const { workspaces, error, refresh, remembered } = useWorkspaces();

const view = computed(() => (route.path === '/trace' ? 'trace' : 'graph'));
const title = computed(() => t(view.value === 'trace' ? 'trace.title' : 'traffic.title'));
useHead({ title: () => `${title.value} · ${t('app.name')}` });

watch(workspaces, async (list) => {
  const target = list && workspaceRedirect(view.value, route.query, list.map(({ slug }) => slug), remembered.value);
  if (target) {
    await navigateTo(target, { replace: true });
  }
}, { immediate: true });
</script>

<template>
  <AppShell
    :user="session?.user"
    :workspaces="workspaces"
    :can-create="session?.user.role === 'admin'"
    :view="view"
    @sign-out="signOut"
  >
    <h1 class="text-2xl font-semibold">
      {{ title }}
    </h1>
    <div
      v-if="error"
      role="alert"
      class="flex flex-col items-start gap-3 rounded-md border border-error p-4"
    >
      <p>{{ t('traffic.error') }}</p>
      <UButton
        icon="i-lucide-refresh-cw"
        @click="refresh()"
      >
        {{ t('common.retry') }}
      </UButton>
    </div>
    <NoWorkspace
      v-else-if="workspaces?.length === 0"
      :can-create="session?.user.role === 'admin'"
    />
  </AppShell>
</template>
