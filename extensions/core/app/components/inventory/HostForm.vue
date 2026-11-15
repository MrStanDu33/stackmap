<script setup lang="ts">
import type { HostInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

import { COMMON_EMPTY, orNull, useInventoryForm } from '~/composables/useEntityForm';

/** The host form of the inventory: name, kind, OS, site and addresses, then the common fields. */
const props = defineProps<EntityFormProps>();
const emit = defineEmits<{ submit: [values: HostInput]; dirty: [dirty: boolean] }>();

// As the host schema allows.
const MAX_ADDRESSES = 32;

const { t } = useI18n();
const label = (field: string) => t(`extensions.core.fields.host.${field}`);
const { values, common, id, issue, submit } = useInventoryForm(props, {
  name: '', kind: '', os: null as string | null, siteId: null as string | null,
  addresses: [] as { address: string; networkId: string | null }[],
  ...COMMON_EMPTY,
}, {
  submit: (input) => {
    emit('submit', { ...input, os: orNull(input.os) as string | null } as HostInput);
  },
  dirty: (dirty) => {
    emit('dirty', dirty);
  },
});

const addAddress = async () => {
  values.value.addresses = [...values.value.addresses, { address: '', networkId: null }];
  await nextTick();
  document.getElementById(id(`addresses.${String(values.value.addresses.length - 1)}.address`))?.focus();
};
const removeAddress = (index: number) => {
  values.value.addresses = values.value.addresses.filter((_, at) => at !== index);
};
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
      entity="host"
      :label="label('kind')"
      required
      :errors="issue('kind')"
      :readonly="readonly"
    />
    <EntityField
      :label="label('os')"
      :errors="issue('os')"
    >
      <UInput
        :id="id('os')"
        :model-value="values.os ?? undefined"
        :readonly="readonly"
        autocomplete="off"
        class="w-full"
        @update:model-value="values.os = $event"
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
    <fieldset class="flex flex-col gap-3">
      <legend class="text-sm font-medium">
        {{ label('addresses') }}
      </legend>
      <p
        v-if="issue('addresses').length > 0"
        class="text-sm text-error"
      >
        {{ issue('addresses').join(' ') }}
      </p>
      <div
        v-for="(item, index) in values.addresses"
        :key="index"
        class="flex flex-wrap items-start gap-2"
      >
        <EntityField
          :label="`${label('address')} ${index + 1}`"
          required
          :errors="issue(`addresses.${index}.address`)"
          class="min-w-40 flex-1"
        >
          <UInput
            :id="id(`addresses.${index}.address`)"
            v-model="item.address"
            :readonly="readonly"
            autocomplete="off"
            spellcheck="false"
            class="w-full"
          />
        </EntityField>
        <ReferenceSelect
          :id="id(`addresses.${index}.networkId`)"
          v-model="item.networkId"
          :label="`${label('networkId')} ${index + 1}`"
          :items="references['core/network'] ?? []"
          nullable
          :required="false"
          :errors="issue(`addresses.${index}.networkId`)"
          :readonly="readonly"
          class="min-w-40 flex-1"
        />
        <UButton
          v-if="!readonly"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          class="mt-6"
          :aria-label="t('extensions.core.fields.host.removeAddress', { number: index + 1 })"
          @click="removeAddress(index)"
        />
      </div>
      <UButton
        v-if="!readonly && values.addresses.length < MAX_ADDRESSES"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="addAddress"
      >
        {{ label('addAddress') }}
      </UButton>
    </fieldset>
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
