<script setup lang="ts">
import type { SiteInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

import { COMMON_EMPTY, useInventoryForm } from '~/composables/useEntityForm';

/** The site form of the inventory: its name, then the common fields. */
const props = defineProps<EntityFormProps>();
const emit = defineEmits<{ submit: [values: SiteInput]; dirty: [dirty: boolean] }>();

const { t } = useI18n();
const { values, common, id, issue, submit } = useInventoryForm(props, { name: '', ...COMMON_EMPTY }, {
  submit: (input) => {
    emit('submit', input as SiteInput);
  },
  dirty: (dirty) => {
    emit('dirty', dirty);
  },
});
</script>

<template>
  <form
    :id="formId"
    novalidate
    class="flex flex-col gap-4"
    @submit.prevent="submit"
  >
    <EntityField
      :label="t('extensions.core.fields.site.name')"
      required
      :errors="issue('name')"
    >
      <UInput
        :id="id('name')"
        v-model="values.name"
        :readonly="readonly"
        autocomplete="off"
        class="w-full"
      />
    </EntityField>
    <CommonFields
      v-model="common"
      :form-id="formId"
      :issues="issues"
      :readonly="readonly"
      :origin="String(entity?.origin ?? 'manual')"
      :external-ref="(entity?.externalRef as string | null | undefined) ?? null"
    />
  </form>
</template>
