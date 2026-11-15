<script setup lang="ts">
import type { ServiceInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

import { COMMON_EMPTY, orNull, useInventoryForm } from '~/composables/useEntityForm';

/** The service form of the inventory: name, kind, host, image and container name, then the common fields. */
const props = defineProps<EntityFormProps>();
const emit = defineEmits<{ submit: [values: ServiceInput]; dirty: [dirty: boolean] }>();

const { t } = useI18n();
const label = (field: string) => t(`extensions.core.fields.service.${field}`);
const { values, common, id, issue, submit } = useInventoryForm(props, {
  name: '', kind: '', hostId: null as string | null, image: null as string | null, containerName: null as string | null,
  ...COMMON_EMPTY,
}, {
  submit: (input) => {
    emit('submit', {
      ...input,
      image: orNull(input.image) as string | null,
      containerName: orNull(input.containerName) as string | null,
    } as ServiceInput);
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
      :label="label('name')"
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
    <KindSelect
      :id="id('kind')"
      v-model="values.kind"
      entity="service"
      :label="label('kind')"
      required
      :errors="issue('kind')"
      :readonly="readonly"
    />
    <ReferenceSelect
      :id="id('hostId')"
      v-model="values.hostId"
      :label="label('hostId')"
      :items="references['core/host'] ?? []"
      nullable
      :required="false"
      :errors="issue('hostId')"
      :readonly="readonly"
    />
    <EntityField
      :label="label('image')"
      :errors="issue('image')"
    >
      <UInput
        :id="id('image')"
        :model-value="values.image ?? undefined"
        :readonly="readonly"
        autocomplete="off"
        spellcheck="false"
        class="w-full"
        @update:model-value="values.image = $event"
      />
    </EntityField>
    <EntityField
      :label="label('containerName')"
      :errors="issue('containerName')"
    >
      <UInput
        :id="id('containerName')"
        :model-value="values.containerName ?? undefined"
        :readonly="readonly"
        autocomplete="off"
        spellcheck="false"
        class="w-full"
        @update:model-value="values.containerName = $event"
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
