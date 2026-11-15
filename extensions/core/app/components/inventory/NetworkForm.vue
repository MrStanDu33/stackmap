<script setup lang="ts">
import type { NetworkInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

import { COMMON_EMPTY, numberOrNull, orNull, useInventoryForm } from '~/composables/useEntityForm';

/** The network form of the inventory: name, kind, address range, VLAN and site, then the common fields. */
const props = defineProps<EntityFormProps>();
const emit = defineEmits<{ submit: [values: NetworkInput]; dirty: [dirty: boolean] }>();

const { t } = useI18n();
const label = (field: string) => t(`extensions.core.fields.network.${field}`);
const { values, common, id, issue, submit } = useInventoryForm(props, {
  name: '', kind: '', cidr: null as string | null, vlan: null as number | string | null, siteId: null as string | null,
  ...COMMON_EMPTY,
}, {
  submit: (input) => {
    emit('submit', {
      ...input, cidr: orNull(input.cidr) as string | null, vlan: numberOrNull(input.vlan),
    } as NetworkInput);
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
      entity="network"
      :label="label('kind')"
      required
      :errors="issue('kind')"
      :readonly="readonly"
    />
    <EntityField
      :label="label('cidr')"
      :errors="issue('cidr')"
    >
      <UInput
        :id="id('cidr')"
        :model-value="values.cidr ?? undefined"
        :readonly="readonly"
        autocomplete="off"
        spellcheck="false"
        class="w-full"
        @update:model-value="values.cidr = $event"
      />
    </EntityField>
    <EntityField
      :label="label('vlan')"
      :errors="issue('vlan')"
    >
      <UInput
        :id="id('vlan')"
        :model-value="values.vlan ?? undefined"
        type="number"
        min="1"
        max="4094"
        :readonly="readonly"
        class="w-full"
        @update:model-value="values.vlan = $event"
      />
    </EntityField>
    <ReferenceSelect
      :id="id('siteId')"
      v-model="values.siteId"
      :label="label('siteId')"
      :items="references['core/site'] ?? []"
      nullable
      :required="false"
      :errors="issue('siteId')"
      :readonly="readonly"
    />
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
