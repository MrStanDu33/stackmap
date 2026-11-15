<script setup lang="ts">
import { DNS_RECORD_TYPES, DNS_VIEWS } from '@stackmap/extension-core/entities';

import type { DnsRecordInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

import { COMMON_EMPTY, useInventoryForm } from '~/composables/useEntityForm';

/** The DNS record form of the inventory: domain, name, type, value, view and proxied. */
const props = defineProps<EntityFormProps>();
const emit = defineEmits<{ submit: [values: DnsRecordInput]; dirty: [dirty: boolean] }>();

const { t } = useI18n();
const label = (field: string) => t(`extensions.core.fields.dns-record.${field}`);
// Record types are DNS's own names, the same in every language.
const types = DNS_RECORD_TYPES.map((value): { value: string; label: string } => ({ value, label: value }));
const views = computed(() => DNS_VIEWS.map((value): { value: string; label: string } => ({ value, label: t(`extensions.core.dnsViews.${value}`) })));
const { values, common, id, issue, submit } = useInventoryForm(props, {
  domainId: null as string | null, name: '', type: 'A', value: '', view: 'public', proxied: false,
  ...COMMON_EMPTY,
}, {
  submit: (input) => {
    emit('submit', input as unknown as DnsRecordInput);
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
      :id="id('domainId')"
      v-model="values.domainId"
      :label="label('domainId')"
      :items="references['core/domain'] ?? []"
      :nullable="false"
      required
      :errors="issue('domainId')"
      :readonly="readonly"
    />
    <EntityField
      :label="label('name')"
      :hint="label('nameHint')"
      required
      :errors="issue('name')"
    >
      <UInput
        :id="id('name')"
        v-model="values.name"
        :readonly="readonly"
        autocomplete="off"
        spellcheck="false"
        class="w-full"
      />
    </EntityField>
    <EntityField
      :label="label('type')"
      required
      :errors="issue('type')"
    >
      <ChoiceSelect
        :id="id('type')"
        v-model="values.type"
        :items="types"
        :readonly="readonly"
      />
    </EntityField>
    <EntityField
      :label="label('value')"
      :hint="t(`extensions.core.fields.dns-record.valueHint.${values.type}`)"
      required
      :errors="issue('value')"
    >
      <UInput
        :id="id('value')"
        v-model="values.value"
        :readonly="readonly"
        autocomplete="off"
        spellcheck="false"
        class="w-full"
      />
    </EntityField>
    <EntityField
      :label="label('view')"
      required
      :errors="issue('view')"
    >
      <ChoiceSelect
        :id="id('view')"
        v-model="values.view"
        :items="views"
        :readonly="readonly"
      />
    </EntityField>
    <EntityField
      :label="label('proxied')"
      :errors="issue('proxied')"
    >
      <!-- Read-only, yes or no as read-only text: reachable and at full contrast, unlike a disabled checkbox. -->
      <UInput
        v-if="readonly"
        :id="id('proxied')"
        :model-value="t(values.proxied ? 'inventory.yes' : 'inventory.no')"
        readonly
        class="w-full"
      />
      <UCheckbox
        v-else
        :id="id('proxied')"
        v-model="values.proxied"
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
