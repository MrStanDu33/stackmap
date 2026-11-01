/** Longest slug the API accepts. */
const MAX_SLUG = 48;

/** A workspace's slug from its name: lower case, no accents, kebab-case from a letter on, at most 48 characters. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG + 1)
    .replace(/^[^a-z]+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '');
}
