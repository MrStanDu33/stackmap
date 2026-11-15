<script setup lang="ts">
import type { FlowInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

import { COMMON_EMPTY, orNull, useInventoryForm } from '~/composables/useEntityForm';

/** The flow form of the inventory: source service, target listener, protocol, purpose and encryption. */
const props = defineProps<EntityFormProps>();
const emit = defineEmits<{ submit: [values: FlowInput]; dirty: [dirty: boolean] }>();

const ENCRYPTED = { unknown: null, yes: true, no: false } as const;
type Encrypted = keyof typeof ENCRYPTED;

const { t } = useI18n();
const label = (field: string) => t(`extensions.core.fields.flow.${field}`);
const encryptedItems = computed(() => (Object.keys(ENCRYPTED) as Encrypted[])
  .map((value) => ({ value, label: t(`extensions.core.fields.flow.encryptedValues.${value}`) })));
const { values, common, id, issue, submit } = useInventoryForm(props, {
  sourceServiceId: null as string | null,
  targetListenerId: null as string | null,
  protocol: null as string | null,
  purpose: null as string | null,
  encrypted: null as boolean | null,
  ...COMMON_EMPTY,
}, {
  submit: (input) => {
    emit('submit', { ...input, purpose: orNull(input.purpose) as string | null } as FlowInput);
  },
  dirty: (dirty) => {
    emit('dirty', dirty);
  },
});
// Yes, no or unknown: a select of three, since a checkbox cannot say unknown.
const encrypted = computed({
  get: (): Encrypted => (values.value.encrypted === null ? 'unknown' : (values.value.encrypted ? 'yes' : 'no')),
  set: (value: Encrypted) => {
    values.value.encrypted = ENCRYPTED[value];
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
    <ReferenceSelect
      :id="id('sourceServiceId')"
      v-model="values.sourceServiceId"
      :label="label('sourceServiceId')"
      :items="references['core/service'] ?? []"
      :nullable="false"
      required
      :errors="issue('sourceServiceId')"
      :readonly="readonly"
    />
    <ReferenceSelect
      :id="id('targetListenerId')"
      v-model="values.targetListenerId"
      :label="label('targetListenerId')"
      :items="references['core/listener'] ?? []"
      :nullable="false"
      required
      :errors="issue('targetListenerId')"
      :readonly="readonly"
    />
    <KindSelect
      :id="id('protocol')"
      v-model="values.protocol"
      entity="protocol"
      :label="label('protocol')"
      :required="false"
      nullable
      :errors="issue('protocol')"
      :readonly="readonly"
    />
    <EntityField
      :label="label('purpose')"
      :errors="issue('purpose')"
    >
      <UInput
        :id="id('purpose')"
        :model-value="values.purpose ?? undefined"
        :readonly="readonly"
        class="w-full"
        @update:model-value="values.purpose = $event"
      />
    </EntityField>
    <EntityField
      :label="label('encrypted')"
      :errors="issue('encrypted')"
    >
      <USelect
        :id="id('encrypted')"
        v-model="encrypted"
        :items="encryptedItems"
        value-key="value"
        :disabled="readonly"
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
