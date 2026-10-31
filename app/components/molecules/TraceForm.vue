<script setup lang="ts">
import { parseTraceQuery } from '../../utils/trace-query';

import type { TraceQuery, TraceQueryErrors } from '../../utils/trace-query';

/** The trace to show: a hostname, the client it comes from, and an optional port. */
const props = defineProps<{
  /** What the URL holds, valid or not. */
  query?: Partial<Record<'hostname' | 'client' | 'port', string>> | null;
  /** What is wrong with it: the URL is checked like the form. */
  errors?: TraceQueryErrors;
  suggestions?: readonly string[];
}>();
const emit = defineEmits<{ submit: [query: TraceQuery] }>();

const { t } = useI18n();
const hostname = ref('');
const client = ref<'public' | 'internal'>('public');
const port = ref('');
const fieldErrors = ref<TraceQueryErrors>({});

// The query shown so far (the URL's) fills the form; by value, so the same query passed again (the view changed)
// leaves what the user is typing alone.
watch([() => props.query?.hostname, () => props.query?.client, () => props.query?.port], ([name, from, only]) => {
  if (props.query) {
    hostname.value = name ?? '';
    client.value = from === 'internal' ? 'internal' : 'public';
    port.value = only ?? '';
  }
}, { immediate: true });
watch([() => props.errors?.hostname, () => props.errors?.port], ([onHostname, onPort]) => {
  fieldErrors.value = { ...(onHostname && { hostname: onHostname }), ...(onPort && { port: onPort }) };
}, { immediate: true });

/** Said to screen readers: an error on a field that already has focus would otherwise go unheard. */
const announcement = ref('');

const clients = computed(() => [
  { label: t('traffic.client.public'), value: 'public' },
  { label: t('traffic.client.internal'), value: 'internal' },
]);

const form = useTemplateRef<HTMLFormElement>('form');
/** Checks the input as the route does; sends it, or shows the errors and moves focus to the first invalid field. */
const submit = async () => {
  const { query, errors: found } = parseTraceQuery({
    hostname: hostname.value, client: client.value, port: port.value,
  });
  // The URL may leave the hostname out; the form needs one.
  fieldErrors.value = { ...(hostname.value.trim() ? {} : { hostname: 'trace.form.error.hostname' }), ...found };
  if (query) {
    emit('submit', query);
    return;
  }
  await focusFirstError();
};

async function focusFirstError({ announce = true } = {}) {
  const first = fieldErrors.value.hostname ? 'hostname' : 'port';
  const key = fieldErrors.value[first];
  if (!key) {
    return;
  }
  // Emptied first, so the same error said twice is still announced.
  announcement.value = '';
  await nextTick();
  if (announce) {
    announcement.value = t(key);
  }
  form.value?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
}

// Errors the URL brought: shown and focused, not announced: the focused field's description already says them.
onMounted(() => {
  void focusFirstError({ announce: false });
});

const listId = useId();
</script>

<template>
  <form
    ref="form"
    role="search"
    :aria-label="t('trace.form.label')"
    class="flex flex-wrap items-start gap-4"
    novalidate
    @submit.prevent="submit"
  >
    <UFormField
      :label="t('trace.form.hostname')"
      :hint="t('trace.form.hostnameHint')"
      :error="fieldErrors.hostname && t(fieldErrors.hostname)"
      name="hostname"
      class="min-w-64 flex-1"
    >
      <UInput
        v-model="hostname"
        name="hostname"
        :list="listId"
        autocomplete="off"
        spellcheck="false"
        class="w-full"
      />
      <datalist :id="listId">
        <option
          v-for="name in suggestions"
          :key="name"
          :value="name"
        />
      </datalist>
    </UFormField>
    <URadioGroup
      v-model="client"
      :items="clients"
      :legend="t('trace.form.client')"
      orientation="horizontal"
    />
    <UFormField
      :label="t('trace.form.port')"
      :hint="t('trace.form.portHint')"
      :error="fieldErrors.port && t(fieldErrors.port)"
      name="port"
    >
      <UInput
        v-model="port"
        name="port"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        class="w-32"
      />
    </UFormField>
    <p
      role="status"
      class="sr-only"
    >
      {{ announcement }}
    </p>
    <UButton
      type="submit"
      icon="i-lucide-route"
      class="mt-6"
    >
      {{ t('trace.form.submit') }}
    </UButton>
  </form>
</template>
