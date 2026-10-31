<script setup lang="ts">
import { FetchError } from 'ofetch';

import type { Session } from '#shared/contracts/auth';

const { t } = useI18n();
const { signedIn } = useAccount();

useHead({ title: () => `${t('auth.setup.title')} · ${t('app.name')}` });

const { data: setup } = await useFetch<{ state: 'open' | 'closed' | 'done'; minutes: number }>('/api/setup');
const busy = ref(false);
const failed = ref(false);
const errors = ref<Partial<Record<'name' | 'email' | 'password', string>>>({});

const FIELD_ERRORS = { name: 'auth.error.name', email: 'auth.error.email', password: 'auth.error.password' } as const;

const submit = async (account: { name: string; email: string; password: string; demo: boolean }) => {
  busy.value = true;
  failed.value = false;
  try {
    signedIn(await $fetch<Session>('/api/setup', { method: 'POST', body: account }));
    await navigateTo('/graph', { replace: true });
  } catch (error) {
    const status = error instanceof FetchError ? error.status : undefined;
    if (status === 400) {
      // The server's checks, by field: `body.email` → the email field's message.
      const issues = (error as FetchError<{ issues?: { path: string }[] }>).data?.issues ?? [];
      errors.value = Object.fromEntries(Object.entries(FIELD_ERRORS)
        .filter(([field]) => issues.some(({ path }) => path === `body.${field}`)));
    } else if (status === 409) {
      await navigateTo('/login', { replace: true });
    } else if (status === 403 && setup.value) {
      setup.value = { ...setup.value, state: 'closed' };
    } else {
      failed.value = true;
    }
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <AuthTemplate :title="t('auth.setup.title')">
    <p v-if="setup?.state === 'closed'">
      {{ t('auth.setup.closed', { minutes: setup.minutes }) }}
    </p>
    <div
      v-else
      class="flex flex-col gap-4"
    >
      <p class="text-muted">
        {{ t('auth.setup.intro') }}
      </p>
      <UAlert
        v-if="failed"
        role="alert"
        color="error"
        variant="outline"
        icon="i-lucide-circle-alert"
        :title="t('auth.error.network')"
      />
      <SetupForm
        :busy="busy"
        :errors="errors"
        @submit="submit"
      />
    </div>
  </AuthTemplate>
</template>
