<script setup lang="ts">
import { TRANSPORTS } from '@stackmap/extension-core/entities';

import type { PortForwardInput } from '@stackmap/extension-nat/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

import { COMMON_EMPTY, numberOrNull, orNull, useInventoryForm } from '~/composables/useEntityForm';

/** The port forward form of the inventory: host, external address and port, transport, internal address and port. */
const props = defineProps<EntityFormProps>();
const emit = defineEmits<{ submit: [values: PortForwardInput]; dirty: [dirty: boolean] }>();

const { t } = useI18n();
const label = (field: string) => t(`extensions.nat.fields.port-forward.${field}`);
const transports = computed(() => TRANSPORTS.map((value) => ({ value: value, label: t(`extensions.core.transports.${value}`) })));
const { values, common, id, issue, submit } = useInventoryForm(props, {
  hostId: null as string | null,
  externalAddress: '',
  externalPort: null as number | string | null,
  transport: 'tcp',
  internalAddress: '',
  internalPort: null as number | string | null,
  description: null as string | null,
  ...COMMON_EMPTY,
}, {
  submit: (input) => {
    emit('submit', {
      ...input,
      externalPort: numberOrNull(input.externalPort),
      internalPort: numberOrNull(input.internalPort),
      description: orNull(input.description) as string | null,
    } as PortForwardInput);
  },
  dirty: (dirty) => {
    emit('dirty', dirty);
  },
});

const hostAddresses = (hostId: string | null): string[] => {
  const host = props.references['core/host']?.find((option) => option.id === hostId)?.entity;
  return ((host?.addresses ?? []) as { address: string }[]).map(({ address }) => address);
};
const addresses = computed(() => hostAddresses(values.value.hostId));
const externalChoices = computed(() => {
  const current = values.value.externalAddress;
  // An address no longer on the host is kept, said unavailable, so that saving does not drop it.
  const unavailable = current && !addresses.value.includes(current)
    ? [{ value: current, label: t('inventory.unavailable', { id: current }) }]
    : [];
  return [...addresses.value.map((address) => ({ value: address, label: address })), ...unavailable];
});
const externalHint = computed(() => {
  if (!values.value.hostId) {
    return label('chooseHostFirst');
  }
  return addresses.value.length === 0 ? label('hostWithoutAddress') : undefined;
});
// On the editor's choice only: a reload of the entity keeps its address, even one no longer on the host.
const chooseHost = (hostId: string | null) => {
  const next = hostAddresses(hostId);
  const { externalAddress } = values.value;
  values.value.hostId = hostId;
  if (!next.includes(externalAddress)) {
    values.value.externalAddress = next.length === 1 ? (next[0] ?? '') : '';
  }
};
</script>

<template>
  <form
    :id="formId"
    novalidate
    class="flex flex-col gap-4"
    @submit.prevent="submit"
  >
    <ReferenceSelect
      :id="id('hostId')"
      :model-value="values.hostId"
      :label="label('hostId')"
      :items="references['core/host'] ?? []"
      :nullable="false"
      required
      :errors="issue('hostId')"
      :readonly="readonly"
      @update:model-value="chooseHost"
    />
    <EntityField
      :label="label('externalAddress')"
      :hint="externalHint"
      required
      :errors="issue('externalAddress')"
    >
      <ChoiceSelect
        :id="id('externalAddress')"
        v-model="values.externalAddress"
        :items="externalChoices"
        :readonly="readonly"
      />
    </EntityField>
    <EntityField
      :label="label('externalPort')"
      :hint="label('portHint')"
      required
      :errors="issue('externalPort')"
    >
      <UInput
        :id="id('externalPort')"
        :model-value="values.externalPort ?? undefined"
        type="number"
        min="1"
        max="65535"
        :readonly="readonly"
        class="w-full"
        @update:model-value="values.externalPort = $event"
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
    <EntityField
      :label="label('internalAddress')"
      required
      :errors="issue('internalAddress')"
    >
      <UInput
        :id="id('internalAddress')"
        v-model="values.internalAddress"
        :readonly="readonly"
        autocomplete="off"
        spellcheck="false"
        class="w-full"
      />
    </EntityField>
    <EntityField
      :label="label('internalPort')"
      :hint="label('portHint')"
      required
      :errors="issue('internalPort')"
    >
      <UInput
        :id="id('internalPort')"
        :model-value="values.internalPort ?? undefined"
        type="number"
        min="1"
        max="65535"
        :readonly="readonly"
        class="w-full"
        @update:model-value="values.internalPort = $event"
      />
    </EntityField>
    <EntityField
      :label="label('description')"
      :errors="issue('description')"
    >
      <UInput
        :id="id('description')"
        :model-value="values.description ?? undefined"
        :readonly="readonly"
        class="w-full"
        @update:model-value="values.description = $event"
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
