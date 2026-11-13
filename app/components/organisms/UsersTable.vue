<script setup lang="ts">
import type { UserAccount } from '#shared/contracts/users';

type Role = UserAccount['role'];

/**
 * The instance's accounts, for its administrator: a role select, New temporary password and Remove on every row but
 * their own. The server refuses the same changes.
 */
const props = defineProps<{
  users: UserAccount[];
  /** The administrator's own account id. */
  me: string;
  error?: { code: 'last_admin' | 'network' } | { code: 'last_owner'; name: string; workspaces: string[] } | null;
}>();
const emit = defineEmits<{
  changeRole: [userId: string, role: Role];
  remove: [userId: string];
  resetPassword: [userId: string];
}>();

const { t, locale } = useI18n();
const titleId = useId();
const hintId = useId();
const onlyYou = computed(() => props.users.length === 1 && props.users[0]?.id === props.me);

const created = (iso: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(iso));
const roleItems = computed(() => (['user', 'admin'] as const).map((value) => ({ label: t(`users.roleLabel.${value}`), value })));

const errorText = computed(() => {
  const error = props.error;
  if (!error) {
    return '';
  }
  if (error.code === 'last_owner') {
    const workspaces = new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(error.workspaces);
    return t('users.lastOwner', { name: error.name, workspaces });
  }
  return t(error.code === 'last_admin' ? 'users.lastAdmin' : 'users.error.change');
});

/** The account waiting for the removal to be confirmed: kept while the dialog closes, so it keeps its name. */
const removing = ref<UserAccount>();
const confirmOpen = ref(false);
const wasConfirmed = ref(false);
const askRemove = (user: UserAccount) => {
  removing.value = user;
  wasConfirmed.value = false;
  confirmOpen.value = true;
};
const confirmed = () => {
  wasConfirmed.value = true;
  confirmOpen.value = false;
  if (removing.value) {
    emit('remove', removing.value.id);
  }
};
// Cancelled, focus returns to Remove; confirmed, the row is going away, and the outcome takes the focus instead.
const onCloseAutoFocus = (event: Event) => {
  if (wasConfirmed.value) {
    event.preventDefault();
  }
};

const root = useTemplateRef<HTMLElement>('root');
// A refusal takes the focus, so it is read where the reader is.
watch(() => props.error, async (error) => {
  if (error) {
    await nextTick();
    root.value?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }
}, { immediate: true });

defineExpose({
  /** Focuses the table's heading: after a change removed the row that had the focus. */
  focusHeading: () => {
    root.value?.querySelector<HTMLElement>(`[id="${titleId}"]`)?.focus();
  },
});
</script>

<template>
  <div
    ref="root"
    class="flex flex-col gap-4"
  >
    <UAlert
      v-if="error"
      role="alert"
      tabindex="-1"
      color="error"
      variant="outline"
      :title="errorText"
    />

    <section class="flex flex-col gap-2">
      <h2
        :id="titleId"
        tabindex="-1"
        class="text-lg font-semibold outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        {{ t('users.accounts') }}
      </h2>
      <div class="overflow-x-auto">
        <table
          class="w-full text-start text-sm"
          :aria-labelledby="titleId"
          :aria-describedby="onlyYou ? hintId : undefined"
        >
          <thead>
            <tr class="border-b border-default">
              <th
                v-for="column in ['name', 'email', 'role', 'createdAt', 'actions']"
                :key="column"
                scope="col"
                class="p-2 text-start"
              >
                {{ t(`users.${column}`) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in users"
              :key="user.id"
              class="border-b border-default"
            >
              <th
                scope="row"
                class="p-2 text-start font-medium"
              >
                {{ user.name }}
                <span
                  v-if="user.id === me"
                  class="text-muted"
                >{{ t('users.you') }}</span>
              </th>
              <td class="p-2">
                {{ user.email }}
              </td>
              <td class="p-2">
                <USelect
                  v-if="user.id !== me"
                  :model-value="user.role"
                  :items="roleItems"
                  :aria-label="t('users.roleOf', { name: user.name })"
                  class="min-w-36"
                  @update:model-value="emit('changeRole', user.id, $event as Role)"
                />
                <span v-else>{{ t(`users.roleLabel.${user.role}`) }}</span>
              </td>
              <td class="p-2">
                <time :datetime="user.createdAt">{{ created(user.createdAt) }}</time>
              </td>
              <td class="p-2">
                <div
                  v-if="user.id !== me"
                  class="flex gap-2"
                >
                  <UButton
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-key-round"
                    :aria-label="t('users.newPasswordFor', { name: user.name })"
                    @click="emit('resetPassword', user.id)"
                  />
                  <UButton
                    color="error"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-user-minus"
                    :aria-label="t('users.remove', { name: user.name })"
                    @click="askRemove(user)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="onlyYou"
        :id="hintId"
        class="text-sm text-muted"
      >
        {{ t('users.onlyYou') }}
      </p>
    </section>

    <UModal
      v-model:open="confirmOpen"
      :content="{ onCloseAutoFocus }"
      :title="t('users.remove', { name: removing?.name ?? '' })"
      :description="t('users.removeQuestion', { name: removing?.name ?? '' })"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            @click="confirmOpen = false"
          >
            {{ t('users.cancel') }}
          </UButton>
          <UButton
            color="error"
            @click="confirmed"
          >
            {{ t('users.remove', { name: removing?.name ?? '' }) }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
