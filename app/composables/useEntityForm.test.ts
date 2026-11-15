import { describe, expect, it, vi } from 'vitest';

import { entityPatch, formValues, problemIssues, useEntityForm } from './useEntityForm';
import { problemOf } from '../../shared/contracts/errors';
import { createTestI18n } from '../../tests/support/i18n';

const EMPTY = { name: '', kind: '', siteId: null as string | null, addresses: [] as { address: string; networkId: string | null }[], status: 'active', tags: [] as string[] };

const HOST = {
  id: '0199d6a0-0000-7000-8000-000000000002',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  name: 'nas',
  kind: 'physical',
  siteId: '0199d6a0-0000-7000-8000-000000000001',
  addresses: [{ address: '192.0.2.10', networkId: null }],
  status: 'active',
  tags: ['storage'],
  customFields: { rack: 'A2' },
  origin: 'manual',
  externalRef: null,
};

const { global: i18n } = createTestI18n('en');
const { t } = i18n;
const te = (key: string) => i18n.te(key);
const refused = (code: Parameters<typeof problemOf>[0], extra: Omit<Parameters<typeof problemOf>[1], 'detail' | 'instance'> = {}) =>
  problemOf(code, { detail: 'Refused', instance: '/api/workspaces/w/entities/core/host', ...extra });
const options = {
  fields: ['name', 'kind', 'siteId', 'addresses', 'status', 'tags'],
  t: (key: string, params?: Record<string, unknown>) => t(key, params ?? {}),
  te,
};

describe('useEntityForm', () => {
  it('starts a new entity from the form\'s empty values and an edit from the entity\'s', () => {
    expect(formValues(EMPTY)).toEqual(EMPTY);
    expect(formValues(EMPTY, HOST)).toEqual({
      name: 'nas', kind: 'physical', siteId: HOST.siteId, addresses: HOST.addresses, status: 'active', tags: ['storage'],
    });
  });

  it('given an edit, sends only the changed fields', () => {
    const values = { ...formValues(EMPTY, HOST), name: 'nas-2', tags: ['storage', 'backup'] };

    expect(entityPatch(formValues(EMPTY, HOST), values)).toEqual({ name: 'nas-2', tags: ['storage', 'backup'] });
  });

  it('given an edit with no change, has nothing to send', () => {
    expect(entityPatch(formValues(EMPTY, HOST), formValues(EMPTY, HOST))).toBeNull();
  });

  it('compares arrays and objects by value, so re-adding a removed address is no change', () => {
    const original = formValues(EMPTY, HOST);
    const values = { ...original, addresses: [{ networkId: null, address: '192.0.2.10' }] };

    expect(entityPatch(original, values)).toBeNull();
  });

  it('never sends custom fields, origin or the external reference', () => {
    expect(formValues({ ...EMPTY, customFields: {}, origin: 'manual' }, HOST)).not.toHaveProperty('customFields');
    expect(entityPatch(HOST, { ...HOST, customFields: {}, origin: 'connector:proxmox', externalRef: 'vm-1' })).toBeNull();
  });

  it('knows when there are unsaved changes, and forgets them after a save or a reload', async () => {
    const form = useEntityForm({ empty: EMPTY, entity: HOST, save: () => Promise.resolve() });
    expect(form.dirty.value).toBe(false);

    form.values.value = { ...form.values.value, name: 'nas-2' };
    expect(form.dirty.value).toBe(true);
    await form.submit();
    expect(form.dirty.value).toBe(false);

    form.values.value = { ...form.values.value, name: 'nas-3' };
    form.reset({ ...HOST, name: 'nas-4' });
    expect(form.values.value.name).toBe('nas-4');
    expect(form.dirty.value).toBe(false);
  });

  it('maps body.<field> issues to their field, translated', () => {
    const problem = refused('entity_invalid', {
      issues: [{ path: 'body.name', code: 'too_small', params: { minimum: 1, origin: 'string' }, message: 'Too small' }],
    });

    // A name too short reads as a count of characters (review).
    expect(problemIssues(problem, options).fields).toEqual({ name: [t('issues.too_small_string', { minimum: 1, origin: 'string' })] });
  });

  it('maps an array item\'s issue (body.addresses.1.address) to that item\'s field', () => {
    const problem = refused('entity_invalid', {
      issues: [{ path: 'body.addresses.1.address', code: 'core.duplicate-address', params: { address: '192.0.2.10' }, message: 'Listed twice' }],
    });

    expect(Object.keys(problemIssues(problem, options).fields)).toEqual(['addresses.1.address']);
  });

  it('puts issues without a known field in the summary', () => {
    const problem = refused('entity_invalid', {
      issues: [
        { path: 'body', code: 'unrecognized_keys', params: { keys: 'colour' }, message: 'Unrecognized key: colour' },
        { path: 'body.colour', code: 'custom', params: {}, message: 'No such field' },
      ],
    });

    const issues = problemIssues(problem, options);
    expect(issues.fields).toEqual({});
    // Without a field to go to, the summary shows them as text, not as links to nothing (review).
    expect(issues.summary.map(({ path }) => path)).toEqual([null, null]);
  });

  it('given entity_conflict, marks each named field as taken', () => {
    const issues = problemIssues(refused('entity_conflict', { fields: ['name'] }), options);

    expect(issues.fields).toEqual({ name: [t('inventory.conflict')] });
  });

  it('given reference_invalid, marks the named field as gone', () => {
    expect(problemIssues(refused('reference_invalid', { field: 'siteId' }), options).fields)
      .toEqual({ siteId: [t('inventory.referenceGone')] });
    expect(problemIssues(refused('reference_invalid', { field: null }), options).summary)
      .toEqual([{ path: null, message: t('inventory.referenceGone') }]);
  });

  it('ignores a second submit while saving', async () => {
    let finish: () => void = () => undefined;
    const save = vi.fn(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    const form = useEntityForm({ empty: EMPTY, save });

    const first = form.submit();
    expect(form.saving.value).toBe(true);
    void form.submit();
    finish();
    await first;

    expect(save).toHaveBeenCalledTimes(1);
    expect(form.saving.value).toBe(false);
  });
});
