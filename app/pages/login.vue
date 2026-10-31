<script setup lang="ts">
import { FetchError } from 'ofetch';

import type { Session } from '#shared/contracts/auth';

import { safeRedirect } from '~/utils/auth-redirect';

const { t } = useI18n();
const route = useRoute();
const { signedIn } = useAccount();

useHead({ title: () => `${t('auth.login.title')} · ${t('app.name')}` });

const busy = ref(false);
const error = ref<'invalid' | 'throttled' | 'network' | null>(null);
const retryAfter = ref<number | null>(null);

const submit = async (credentials: { email: string; password: string }) => {
  busy.value = true;
  try {
    signedIn(await $fetch<Session>('/api/session', { method: 'POST', body: credentials }));
    error.value = null;
    // Only a path on this site: a link to /login must not send someone elsewhere once signed in.
    await navigateTo(safeRedirect(route.query.redirect), { replace: true });
  } catch (failure) {
    const status = failure instanceof FetchError ? failure.status : undefined;
    retryAfter.value = Number((failure as FetchError).response?.headers.get('retry-after')) || null;
    error.value = status === 401 ? 'invalid' : status === 429 ? 'throttled' : 'network';
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <AuthTemplate :title="t('auth.login.title')">
    <LoginForm
      :busy="busy"
      :error="error"
      :retry-after="retryAfter"
      @submit="submit"
    />
  </AuthTemplate>
</template>
