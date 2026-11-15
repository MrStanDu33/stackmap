<script setup lang="ts">
import type { WorkspaceExtension } from '#shared/contracts/extensions';

import { useExtensions } from '~/composables/useExtensions';

const { t } = useI18n();
const { session, signOut } = useAccount();
const route = useRoute();
const toast = useToast();

const { workspaces, error: workspaceError, refresh: refreshWorkspaces } = useWorkspaces();
const workspace = computed(() => workspaces.value?.find(({ slug }) => slug === route.params.slug));
const noWorkspace = computed(() => workspaces.value?.length === 0);
const notFound = computed(() => Boolean(workspaces.value?.length) && !workspace.value);
const canCreate = computed(() => session.value?.user.role === 'admin');
const canManage = computed(() => workspace.value?.role === 'admin' || workspace.value?.role === 'owner');

const { extensions: loaded, error: extensionsError, retry } = useExtensions(() => workspace.value?.id);
const extensions = computed(() => loaded.value as WorkspaceExtension[] | null);

useHead({
  title: () => (notFound.value
    ? [t('workspace.notFound'), t('app.name')]
    : [t('onboarding.title'), workspace.value?.name, t('app.name')]).filter(Boolean).join(' · '),
});

// It appears once the list arrives: focus goes to it, so it is heard.
const notFoundHeading = useTemplateRef<HTMLElement>('notFoundHeading');
watch(notFound, async (missing) => {
  if (missing) {
    await nextTick();
    notFoundHeading.value?.focus();
  }
});
const heading = useTemplateRef<HTMLElement>('heading');
// The retry button goes away with the error: focus moves to the page's heading rather than being lost.
const retryLoad = async () => {
  await (workspaceError.value ? refreshWorkspaces() : retry());
  await nextTick();
  heading.value?.focus();
};

const graph = computed(() => `/w/${String(route.params.slug)}/graph`);
const busy = ref(false);
const error = ref<'not-empty' | 'failed' | null>(null);

const submit = async (enabled: string[]) => {
  busy.value = true;
  // Emptied first, so the same error twice is announced again.
  error.value = null;
  try {
    await $fetch(`/api/workspaces/${workspace.value?.id ?? ''}/extensions`, { method: 'PUT', body: { enabled } });
    await retry();
    // A toast outlives this page: a status region here would go before it is read.
    toast.add({ title: t('onboarding.done'), color: 'success', icon: 'i-lucide-check' });
    await navigateTo(graph.value);
  } catch (failure) {
    await nextTick();
    error.value = (failure as { statusCode?: number }).statusCode === 409 ? 'not-empty' : 'failed';
  } finally {
    busy.value = false;
  }
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
      {{ t('onboarding.title') }}
    </h1>

    <div
      v-if="workspaceError || extensionsError"
      role="alert"
      class="flex flex-col items-start gap-3 rounded-md border border-error p-4"
    >
      <p>{{ t('onboarding.loadFailed') }}</p>
      <UButton
        icon="i-lucide-refresh-cw"
        @click="retryLoad"
      >
        {{ t('workspaceExtensions.retry') }}
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
      <h2
        ref="notFoundHeading"
        tabindex="-1"
        class="text-lg font-semibold outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        {{ t('workspace.notFound') }}
      </h2>
      <p class="text-muted">
        {{ t('workspace.notFoundHint') }}
      </p>
    </div>

    <div
      v-else-if="workspace && !canManage"
      class="flex flex-col items-start gap-3"
    >
      <p class="text-muted">
        {{ t('onboarding.forbidden') }}
      </p>
      <ULink
        :to="graph"
        class="underline"
      >
        {{ t('onboarding.toGraph') }}
      </ULink>
    </div>

    <template v-else>
      <p class="text-muted">
        {{ t('onboarding.intro') }}
      </p>
      <StackQuestions
        class="max-w-2xl"
        :extensions="workspace ? extensions : null"
        :busy="busy"
        :error="error"
        :extensions-path="`/w/${String(route.params.slug)}/extensions`"
        @submit="submit"
        @skip="navigateTo(graph)"
      />
    </template>
  </AppShell>
</template>
