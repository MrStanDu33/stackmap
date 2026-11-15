<script setup lang="ts">
import type { WorkspaceExtension } from '../../../shared/contracts/extensions';

/** The workspace's extensions, on or off; admins turn them on and off with switches. */
defineProps<{
  /** Null while loading. */
  extensions: WorkspaceExtension[] | null;
  /** The list could not be loaded. */
  failed: boolean;
  canManage: boolean;
  /** The extension being saved. */
  busy: string | null;
}>();
// The switches show the stored state: the page changes it once a toggle is confirmed and saved.
const emit = defineEmits<{ toggle: [id: string, enabled: boolean]; retry: [] }>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="failed && !extensions"
    role="alert"
    class="flex flex-wrap items-center gap-3"
  >
    <p>{{ t('workspaceExtensions.loadFailed') }}</p>
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-refresh-cw"
      @click="emit('retry')"
    >
      {{ t('workspaceExtensions.retry') }}
    </UButton>
  </div>
  <div
    v-else-if="!extensions"
    aria-busy="true"
    class="flex flex-col gap-3"
  >
    <USkeleton
      v-for="row in 3"
      :key="row"
      class="h-20 w-full"
    />
  </div>
  <ul
    v-else
    class="flex flex-col gap-3"
  >
    <li
      v-for="extension in extensions"
      :key="extension.id"
    >
      <article class="flex items-start gap-4 rounded-md border border-default bg-elevated p-4">
        <UIcon
          :name="extension.icon?.startsWith('i-lucide-') ? extension.icon : 'i-lucide-puzzle'"
          class="mt-1 size-5 shrink-0 text-muted"
          aria-hidden="true"
        />
        <div class="flex min-w-0 grow flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold">
              {{ t(extension.name) }}
            </h2>
            <UBadge
              v-if="extension.state === 'failed'"
              color="error"
              variant="subtle"
            >
              {{ t('workspaceExtensions.failed') }}
            </UBadge>
          </div>
          <p class="text-muted">
            {{ t(extension.description) }}
          </p>
          <p class="text-sm text-muted">
            {{ t('workspaceExtensions.version', { version: extension.version }) }}
          </p>
          <p
            v-if="extension.state === 'failed'"
            class="text-sm"
          >
            {{ t('workspaceExtensions.failedHint') }}
          </p>
        </div>
        <p
          v-if="extension.alwaysOn"
          class="shrink-0 text-sm text-muted"
        >
          {{ t('workspaceExtensions.alwaysOn') }}
        </p>
        <USwitch
          v-else-if="canManage"
          :model-value="extension.enabled"
          :aria-label="t(extension.name)"
          :disabled="busy === extension.id"
          :aria-busy="busy === extension.id ? 'true' : undefined"
          class="shrink-0"
          @update:model-value="(value: boolean) => emit('toggle', extension.id, value)"
        />
        <p
          v-else
          class="shrink-0 text-sm"
        >
          {{ extension.enabled ? t('workspaceExtensions.on') : t('workspaceExtensions.off') }}
        </p>
      </article>
    </li>
  </ul>
</template>
