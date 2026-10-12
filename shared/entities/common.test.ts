import { describe, expect, it } from 'vitest';

import { siteSchema } from './site';
import { issuePaths } from '../../tests/support/issues';

// The common fields are checked through the simplest entity, a site.
const parse = (input: Record<string, unknown>) => siteSchema.input.safeParse({ name: 'Home lab', ...input });

const distinct = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => `${prefix}${String(index)}`);

describe('common entity fields', () => {
  it('defaults status to active, tags, links to [], notes to \'\', customFields to {}, origin to manual', () => {
    expect(parse({})).toEqual({
      success: true,
      data: {
        name: 'Home lab',
        status: 'active',
        tags: [],
        notes: '',
        links: [],
        customFields: {},
        origin: 'manual',
        externalRef: null,
      },
    });
  });

  it('accepts the statuses planned, active and deprecated, and nothing else', () => {
    for (const status of ['planned', 'active', 'deprecated']) {
      expect(parse({ status }).data?.status).toBe(status);
    }
    expect(issuePaths(parse({ status: 'retired' }))).toEqual(['status']);
  });

  it('accepts origin manual or connector:<kebab-id>, and nothing else', () => {
    expect(parse({ origin: 'connector:proxmox-ve' }).data?.origin).toBe('connector:proxmox-ve');
    for (const origin of ['connector:', 'connector:Proxmox', 'import', 'manual:x']) {
      expect(issuePaths(parse({ origin }))).toEqual(['origin']);
    }
  });

  it('accepts values at every bound', () => {
    const result = parse({
      name: 'n'.repeat(100),
      tags: [...distinct(49, 't'), 'x'.repeat(50)],
      notes: 'x'.repeat(20_000),
      links: Array.from({ length: 20 }, (_, index) => ({ label: 'l'.repeat(100), url: `https://docs.example/${String(index)}` })),
      customFields: Object.fromEntries([...distinct(49, 'k'), 'k'.repeat(50)].map((key) => [key, 'v'.repeat(1000)])),
      externalRef: 'r'.repeat(500),
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ['tags', distinct(51, 't'), 'tags'],
    ['tags', ['x'.repeat(51)], 'tags.0'],
    ['tags', [''], 'tags.0'],
    ['notes', 'x'.repeat(20_001), 'notes'],
    ['links', Array.from({ length: 21 }, () => ({ label: 'Docs', url: 'https://docs.example' })), 'links'],
    ['links', [{ label: 'Docs', url: 'ftp://docs.example' }], 'links.0.url'],
    ['links', [{ label: 'l'.repeat(101), url: 'https://docs.example' }], 'links.0.label'],
    ['links', [{ label: '', url: 'https://docs.example' }], 'links.0.label'],
    ['customFields', Object.fromEntries(distinct(51, 'k').map((key) => [key, 1])), 'customFields'],
    ['customFields', { ['k'.repeat(51)]: 1 }, 'customFields'],
    ['customFields', { owner: 'x'.repeat(1001) }, 'customFields.owner'],
    ['customFields', { owner: { nested: true } }, 'customFields.owner'],
    ['customFields', { owner: Number.POSITIVE_INFINITY }, 'customFields.owner'],
    ['externalRef', 'r'.repeat(501), 'externalRef'],
    ['name', 'n'.repeat(101), 'name'],
  ])('given %s over its bounds, fails with an issue on %s', (field, value, path) => {
    const paths = issuePaths(parse({ [field]: value }));

    expect(paths.some((issuePath) => issuePath === path || issuePath.startsWith(`${path}.`))).toBe(true);
  });

  it('given a control character in free text, fails with an issue on that field', () => {
    expect(issuePaths(parse({ name: 'Home\u0007lab' }))).toEqual(['name']);
    expect(issuePaths(parse({ name: 'Home\nlab' }))).toEqual(['name']);
    expect(issuePaths(parse({ notes: 'null \u0000 byte' }))).toEqual(['notes']);
    expect(issuePaths(parse({ tags: ['a\u001Fb'] }))).toEqual(['tags.0']);
    expect(issuePaths(parse({ externalRef: 'ref\nwith a line break' }))).toEqual(['externalRef']);
  });

  it('keeps line breaks and tabs in notes', () => {
    expect(parse({ notes: '# Notes\n\n- item\twith a tab' }).data?.notes).toBe('# Notes\n\n- item\twith a tab');
  });

  it('refuses bidi, zero-width and C1 control characters in every text field, and keeps other Unicode', () => {
    expect(issuePaths(parse({ name: 'admin\u202Egnp.exe' }))).toEqual(['name']);
    expect(issuePaths(parse({ tags: ['a\u200Bb'] }))).toEqual(['tags.0']);
    expect(issuePaths(parse({ notes: 'before \u2066isolated\u2069 after' }))).toEqual(['notes']);
    expect(issuePaths(parse({ customFields: { owner: 'next\u0085line' } }))).toEqual(['customFields.owner']);
    expect(issuePaths(parse({ externalRef: '\uFEFFvm-104' }))).toEqual(['externalRef']);
    // U+200D joins emoji sequences, so it stays allowed.
    expect(parse({ name: 'Café — serveur ✓', notes: 'Ünïcödé 日本語 مرحبا 👨\u200D👩\u200D👧' }).success).toBe(true);
  });

  it('given duplicate tags, keeps each once in its first order', () => {
    expect(parse({ tags: ['web', 'prod', 'web'] }).data?.tags).toEqual(['web', 'prod']);
  });
});
