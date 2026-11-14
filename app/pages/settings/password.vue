<script setup lang="ts">
import { FetchError } from 'ofetch';

// A temporary password's only page until the account chose its own (app/utils/auth-redirect.ts).
const { t } = useI18n();
const { session, signOut, load } = useAccount();

useHead({ title: () => [t('settings.forcedTitle'), t('app.name')].join(' · ') });

// The page says why the person is here: they start on its title.
onMounted(() => {
  document.querySelector<HTMLElement>('main h1')?.focus();
});

const changing = ref(false);
const error = ref<'wrong_password' | 'throttled' | 'network' | null>(null);
const retryAfter = ref<number | null>(null);
const change = async (body: { currentPassword: string; newPassword: string }) => {
  changing.value = true;
  error.value = null;
  try {
    await $fetch('/api/account/password', { method: 'PUT', body });
    // The session now says the mark is gone: then `/` opens the landing page.
    await load();
    if (!(session.value)?.user.mustChangePassword) {
      await navigateTo('/', { replace: true });
    }
  } catch (failure) {
    await nextTick();
    const status = failure instanceof FetchError ? failure.status : undefined;
    retryAfter.value = Number(failure instanceof FetchError ? failure.response?.headers.get('retry-after') : null) || null;
    error.value = status === 400 ? 'wrong_password' : status === 429 ? 'throttled' : 'network';
  } finally {
    changing.value = false;
  }
};
</script>

<template>
  <AuthTemplate :title="t('settings.forcedTitle')">
    <div class="flex flex-col gap-4">
      <p class="text-muted">
        {{ t('settings.forcedIntro') }}
      </p>
      <PasswordForm
        :busy="changing"
        :error="error"
        :retry-after="retryAfter"
        @submit="change"
      />
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-log-out"
        class="self-start"
        @click="signOut()"
      >
        {{ t('auth.signOut') }}
      </UButton>
    </div>
  </AuthTemplate>
</template>
