<script setup lang="ts">
import { FetchError } from 'ofetch';

import type { Preferences } from '#shared/contracts/preferences';

const { t } = useI18n();
const { session, signOut } = useAccount();
const { workspaces } = useWorkspaces();
const preferences = usePreferences();

useHead({ title: () => [t('settings.title'), t('app.name')].join(' · ') });

const displayTitle = useId();
// Shown at once, then saved; the session follows once the account has it.
const landingPage = ref<Preferences['landingPage']>(session.value?.user.preferences.landingPage ?? null);
watch(landingPage, (page) => {
  void preferences.save({ landingPage: page });
});

const changing = ref(false);
const passwordError = ref<'wrong_password' | 'throttled' | 'network' | null>(null);
const retryAfter = ref<number | null>(null);
const changed = ref(false);
const changePassword = async (change: { currentPassword: string; newPassword: string }) => {
  changing.value = true;
  passwordError.value = null;
  changed.value = false;
  try {
    await $fetch('/api/account/password', { method: 'PUT', body: change });
    changed.value = true;
  } catch (failure) {
    await nextTick();
    const status = failure instanceof FetchError ? failure.status : undefined;
    retryAfter.value = Number(failure instanceof FetchError ? failure.response?.headers.get('retry-after') : null) || null;
    passwordError.value = status === 400 ? 'wrong_password' : status === 429 ? 'throttled' : 'network';
  } finally {
    changing.value = false;
  }
};
</script>

<template>
  <AppShell
    :user="session?.user"
    :workspaces="workspaces"
    :can-create="session?.user.role === 'admin'"
    @sign-out="signOut"
  >
    <h1 class="text-2xl font-semibold">
      {{ t('settings.title') }}
    </h1>

    <section
      class="flex flex-col gap-4"
      :aria-labelledby="displayTitle"
    >
      <h2
        :id="displayTitle"
        class="text-lg font-semibold"
      >
        {{ t('settings.display') }}
      </h2>
      <p class="text-sm text-muted">
        {{ t('settings.displayHint') }}
      </p>
      <DisplayPreferences :landmark="false" />
      <LandingPageSelect v-model="landingPage" />
    </section>

    <PasswordForm
      :busy="changing"
      :error="passwordError"
      :retry-after="retryAfter"
      :done="changed"
      @submit="changePassword"
    />
  </AppShell>
</template>
