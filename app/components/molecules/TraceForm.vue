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

// The query shown so far (the URL's) fills the form.
watch(() => props.query, (query) => {
  if (query) {
    hostname.value = query.hostname ?? '';
    client.value = query.client === 'internal' ? 'internal' : 'public';
    port.value = query.port ?? '';
  }
}, { immediate: true });
watch(() => props.errors, (found) => {
  fieldErrors.value = found ?? {};
}, { immediate: true });

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
  fieldErrors.value = query || Object.keys(found).length > 0 ? found : { hostname: 'trace.form.error.hostname' };
  if (query) {
    emit('submit', query);
    return;
  }
  await nextTick();
  const first = fieldErrors.value.hostname ? 'hostname' : 'port';
  form.value?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
};

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
        type="number"
        min="1"
        max="65535"
        class="w-32"
      />
    </UFormField>
    <UButton
      type="submit"
      icon="i-lucide-route"
      class="mt-6"
    >
      {{ t('trace.form.submit') }}
    </UButton>
  </form>
</template>
