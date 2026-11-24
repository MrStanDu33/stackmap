<script setup lang="ts">
import { FetchError } from 'ofetch';

import type { Preferences } from '#shared/contracts/preferences';

const { t } = useI18n();
const { session, signOut } = useAccount();
const { workspaces } = useWorkspaces();
const preferences = usePreferences();
// What Search can look through, listed under its Entities checkbox: the instance's extensions, those that run.
const { extensions } = useExtensions();
const searchable = computed(() => (extensions.value ?? []).filter(({ state }) => state === 'active'));

useHead({ title: () => [t('settings.title'), t('app.name')].join(' · ') });

const displayTitle = useId();
// Shown at once, then saved; the session follows once the account has it.
const landingPage = ref<Preferences['landingPage']>(session.value?.user.preferences.landingPage ?? null);
watch(landingPage, (page) => {
  void preferences.save({ landingPage: page });
});
// What the command palette hides, saved as soon as it changes, one save at a time so that the last choice wins.
const savedHidden = () => [...session.value?.user.preferences.palette.hidden ?? []];
const paletteHidden = ref<string[]>(savedHidden());
let saving = Promise.resolve();
watch(paletteHidden, (hidden) => {
  saving = saving.then(async () => {
    // Put back (below) to what the account has: nothing to save.
    if (JSON.stringify(hidden) === JSON.stringify(savedHidden())) {
      return;
    }
    await preferences.save({ palette: { hidden } });
    // Not saved: the checkboxes show what the account has, not a choice that did not stick.
    if (preferences.status.value === 'error' && hidden === paletteHidden.value) {
      paletteHidden.value = savedHidden();
    }
  });
});
const saveStatus = preferences.status;

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
      <DisplayPreferences
        :landmark="false"
        :status="false"
      />
      <LandingPageSelect v-model="landingPage" />
      <PalettePreferences
        v-model:hidden="paletteHidden"
        :extensions="searchable"
      />
      <!-- After every setting of the section, where the eye is; announced once by the shell (AppShell). -->
      <p
        v-if="saveStatus"
        class="text-sm"
        :class="saveStatus === 'error' ? 'text-error' : 'text-muted'"
      >
        {{ t(saveStatus === 'error' ? 'settings.saveError' : 'settings.saved') }}
      </p>
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
