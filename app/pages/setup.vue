<script setup lang="ts">
import { FetchError } from 'ofetch';

import type { Session } from '#shared/contracts/auth';

const { t } = useI18n();
const { signedIn } = useAccount();

useHead({ title: () => `${t('auth.setup.title')} · ${t('app.name')}` });

const DEFAULT_MINUTES = 15;

const { data: setup } = await useFetch<{ state: 'open' | 'closed' | 'done'; minutes: number }>('/api/setup');
const busy = ref(false);
const failure = ref<{ kind: 'network' } | { kind: 'throttled'; seconds: number } | null>(null);
const errors = ref<Partial<Record<'name' | 'email' | 'password', string>>>({});

const FIELD_ERRORS = { name: 'auth.error.name', email: 'auth.error.email', password: 'auth.error.password' } as const;

const message = computed(() => {
  if (failure.value?.kind === 'throttled') {
    return t('auth.login.throttled', { seconds: failure.value.seconds }, failure.value.seconds);
  }
  return failure.value ? t('auth.error.network') : '';
});
const minutes = computed(() => setup.value?.minutes ?? DEFAULT_MINUTES);

// What replaces the form, or explains why it did not go through, gets the focus: the user is told, and not lost.
const alert = useTemplateRef<HTMLElement>('alert');
const closed = useTemplateRef<HTMLElement>('closed');
const focus = async (target: () => HTMLElement | null | undefined) => {
  await nextTick();
  target()?.focus();
};

const submit = async (account: { name: string; email: string; password: string; demo: boolean }) => {
  busy.value = true;
  failure.value = null;
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
    } else if (status === 403) {
      setup.value = { state: 'closed', minutes: minutes.value };
      await focus(() => closed.value);
    } else {
      failure.value = status === 429
        ? { kind: 'throttled', seconds: Number((error as FetchError).response?.headers.get('retry-after')) || 60 }
        : { kind: 'network' };
      await focus(() => alert.value);
    }
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <AuthTemplate :title="t('auth.setup.title')">
    <p
      v-if="setup?.state === 'closed'"
      ref="closed"
      tabindex="-1"
      class="outline-none focus-visible:outline-2 focus-visible:outline-primary"
    >
      {{ t('auth.setup.closed', { minutes }, minutes) }}
    </p>
    <div
      v-else
      class="flex flex-col gap-4"
    >
      <p class="text-muted">
        {{ t('auth.setup.intro') }}
      </p>
      <!-- A wrapper takes the focus: the alert component does not pass tabindex on. -->
      <div
        v-if="message"
        ref="alert"
        role="alert"
        tabindex="-1"
        class="rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        <UAlert
          color="error"
          variant="outline"
          icon="i-lucide-circle-alert"
          :title="message"
        />
      </div>
      <SetupForm
        :busy="busy"
        :errors="errors"
        @submit="submit"
      />
    </div>
  </AuthTemplate>
</template>
