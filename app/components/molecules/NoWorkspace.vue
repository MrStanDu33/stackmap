<script setup lang="ts">
/** A user without any workspace: the administrator can create one, others are told to ask for an invitation. */
defineProps<{ canCreate: boolean }>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col items-start gap-2 rounded-md border border-default p-6">
    <h2 class="text-lg font-semibold">
      {{ t('traffic.noWorkspace') }}
    </h2>
    <template v-if="canCreate">
      <p class="text-muted">
        {{ t('traffic.noWorkspaceHint') }}
      </p>
      <UButton
        to="/workspaces/new"
        icon="i-lucide-plus"
      >
        {{ t('workspace.create') }}
      </UButton>
    </template>
    <p
      v-else
      class="text-muted"
    >
      {{ t('traffic.noWorkspaceMember') }}
    </p>
  </div>
</template>
