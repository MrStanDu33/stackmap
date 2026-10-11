import { v7 } from 'uuid';

/** A new UUIDv7: unique, and sortable as text in creation order (it starts with a millisecond timestamp). */
export function newId(): string {
  return v7();
}
