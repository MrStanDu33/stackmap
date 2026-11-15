<script setup lang="ts">
import { fieldId } from '../../composables/useEntityForm';

/**
 * The slide-over an entity is created, edited or read in: its form in the slot, Save and Cancel below it, the error
 * summary and the save's refusals above it, and a question before discarding unsaved changes.
 */
const props = defineProps<{
  open: boolean;
  title: string;
  typeLabel: string;
  /** The slot's form's id: Save submits it, and the summary links to its fields (`<formId>-<path>`). */
  formId: string;
  readonly: boolean;
  saving: boolean;
  dirty: boolean;
  summary: { path: string | null; message: string }[];
  state: 'changed' | 'gone' | 'network' | 'forbidden' | null;
}>();
const emit = defineEmits<{
  'update:open': [open: boolean];
  reload: [];
  /** When it would return focus to what opened it: prevented, the page moves focus itself (to a new row…). */
  closeAutoFocus: [event: Event];
}>();

const { t } = useI18n();
// Nuxt UI types no role on a dialog's content; a confirmation is an alert dialog (passed through to the element).
const ALERT_DIALOG: Record<string, unknown> = { role: 'alertdialog' };
const summaryBox = useTemplateRef<HTMLElement>('summaryBox');

/** What waits for the discard question's answer. */
const pending = ref<'close' | 'reload' | null>(null);
const asking = computed({
  get: () => pending.value !== null,
  set: (open: boolean) => {
    if (!open) {
      pending.value = null;
    }
  },
});
const unsaved = computed(() => props.dirty && !props.readonly);

const close = () => {
  // Already closing: focus leaving it then is the page moving focus, not someone closing it.
  if (!props.open) {
    return;
  }
  if (unsaved.value) {
    pending.value = 'close';
  } else {
    emit('update:open', false);
  }
};
const reload = () => {
  if (unsaved.value) {
    pending.value = 'reload';
  } else {
    emit('reload');
  }
};
const discard = () => {
  const action = pending.value;
  pending.value = null;
  if (action === 'close') {
    emit('update:open', false);
  } else if (action === 'reload') {
    emit('reload');
  }
};

// Opened with issues (a refused save reopened), the summary takes the focus rather than the first field.
const onOpenAutoFocus = (event: Event) => {
  if (props.summary.length > 0 && summaryBox.value) {
    event.preventDefault();
    summaryBox.value.focus();
  }
};

// The least destructive answer takes the focus when the question opens.
const keepEditing = useTemplateRef<{ $el: HTMLElement }>('keepEditing');
const onQuestionOpen = (event: Event) => {
  event.preventDefault();
  keepEditing.value?.$el.focus();
};
// Saving: Save stays focusable, said unavailable, and submits nothing more.
const guardSave = (event: Event) => {
  if (props.saving) {
    event.preventDefault();
  }
};

// A row the form does not show (a list edited as text) is reached through its list: hostnames.1, then hostnames.
const targetId = (path: string): string => {
  const parts = path.split('.');
  while (parts.length > 1 && typeof document !== 'undefined' && !document.getElementById(fieldId(props.formId, parts.join('.')))) {
    parts.pop();
  }
  return fieldId(props.formId, parts.join('.'));
};
const focusField = (path: string) => document.getElementById(targetId(path))?.focus();

// A new summary takes the focus, so that it is read where the reader is.
watch(() => props.summary, async (summary) => {
  if (summary.length > 0) {
    await nextTick();
    summaryBox.value?.focus();
  }
}, { immediate: true });
</script>

<template>
  <USlideover
    :open="open"
    :title="title"
    :close="false"
    :dismissible="false"
    :content="{ onOpenAutoFocus, onCloseAutoFocus: (event: Event) => emit('closeAutoFocus', event) }"
    @close:prevent="close"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div
          v-if="summary.length > 0"
          ref="summaryBox"
          role="alert"
          tabindex="-1"
          class="rounded-md border border-error p-3 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <p class="font-medium">
            {{ t('inventory.errorSummary', { type: typeLabel }) }}
          </p>
          <ul class="mt-1 list-disc ps-5">
            <li
              v-for="(issue, index) in summary"
              :key="index"
            >
              <a
                v-if="issue.path"
                :href="`#${targetId(issue.path)}`"
                class="text-error underline"
                @click.prevent="focusField(issue.path)"
              >{{ issue.message }}</a>
              <span v-else>{{ issue.message }}</span>
            </li>
          </ul>
        </div>
        <div
          v-else-if="state"
          role="alert"
          class="flex flex-wrap items-center gap-3 rounded-md border border-error p-3"
        >
          <p>{{ t(`inventory.${state === 'network' ? 'notSaved' : state}`) }}</p>
          <UButton
            v-if="state === 'changed'"
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            @click="reload"
          >
            {{ t('inventory.reload') }}
          </UButton>
        </div>
        <p
          v-if="!readonly"
          class="text-sm text-muted"
        >
          {{ t('inventory.requiredHint') }}
        </p>
        <slot />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          @click="close"
        >
          {{ readonly ? t('inventory.close') : t('inventory.cancel') }}
        </UButton>
        <UButton
          v-if="!readonly"
          type="submit"
          :form="formId"
          :aria-disabled="saving ? 'true' : undefined"
          :aria-busy="saving ? 'true' : undefined"
          :icon="saving ? 'i-lucide-loader-circle' : undefined"
          :ui="{ leadingIcon: saving ? 'motion-safe:animate-spin' : '' }"
          @click="guardSave"
        >
          {{ t('inventory.save') }}
        </UButton>
      </div>
    </template>
  </USlideover>
  <UModal
    v-model:open="asking"
    :title="t('inventory.discard')"
    :content="{ ...ALERT_DIALOG, onOpenAutoFocus: onQuestionOpen }"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          ref="keepEditing"
          color="neutral"
          variant="outline"
          @click="asking = false"
        >
          {{ t('inventory.keepEditing') }}
        </UButton>
        <UButton
          color="error"
          @click="discard"
        >
          {{ t('inventory.discardConfirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
