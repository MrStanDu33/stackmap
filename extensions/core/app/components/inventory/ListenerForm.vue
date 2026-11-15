<script setup lang="ts">
import { TRANSPORTS } from '@stackmap/extension-core/entities';

import type { ListenerInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

import { COMMON_EMPTY, numberOrNull, orNull, useInventoryForm } from '~/composables/useEntityForm';

/** The listener form of the inventory: service, port, transport, protocol, bind address, published port. */
const props = defineProps<EntityFormProps>();
const emit = defineEmits<{ submit: [values: ListenerInput]; dirty: [dirty: boolean] }>();

const { t } = useI18n();
const label = (field: string) => t(`extensions.core.fields.listener.${field}`);
const transports = computed(() => TRANSPORTS.map((value): { value: string; label: string } => ({ value, label: t(`extensions.core.transports.${value}`) })));
const { values, common, id, issue, submit } = useInventoryForm(props, {
  serviceId: null as string | null,
  port: null as number | string | null,
  transport: 'tcp',
  protocol: null as string | null,
  bindAddress: '0.0.0.0',
  publishedPort: null as number | string | null,
  ...COMMON_EMPTY,
}, {
  submit: (input) => {
    emit('submit', {
      ...input,
      port: numberOrNull(input.port),
      bindAddress: orNull(input.bindAddress) as string | null,
      publishedPort: numberOrNull(input.publishedPort),
    } as ListenerInput);
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
    <ReferenceSelect
      :id="id('serviceId')"
      v-model="values.serviceId"
      :label="label('serviceId')"
      :items="references['core/service'] ?? []"
      :nullable="false"
      required
      :errors="issue('serviceId')"
      :readonly="readonly"
    />
    <EntityField
      :label="label('port')"
      :hint="label('portHint')"
      required
      :errors="issue('port')"
    >
      <UInput
        :id="id('port')"
        :model-value="values.port ?? undefined"
        type="number"
        min="1"
        max="65535"
        :readonly="readonly"
        class="w-full"
        @update:model-value="values.port = $event"
      />
    </EntityField>
    <EntityField
      :label="label('transport')"
      required
      :errors="issue('transport')"
    >
      <ChoiceSelect
        :id="id('transport')"
        v-model="values.transport"
        :items="transports"
        :readonly="readonly"
      />
    </EntityField>
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
      :label="label('bindAddress')"
      :hint="label('bindAddressHint')"
      :errors="issue('bindAddress')"
    >
      <UInput
        :id="id('bindAddress')"
        :model-value="values.bindAddress ?? undefined"
        :readonly="readonly"
        autocomplete="off"
        spellcheck="false"
        class="w-full"
        @update:model-value="values.bindAddress = $event"
      />
    </EntityField>
    <EntityField
      :label="label('publishedPort')"
      :hint="label('portHint')"
      :errors="issue('publishedPort')"
    >
      <UInput
        :id="id('publishedPort')"
        :model-value="values.publishedPort ?? undefined"
        type="number"
        min="1"
        max="65535"
        :readonly="readonly"
        class="w-full"
        @update:model-value="values.publishedPort = $event"
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
