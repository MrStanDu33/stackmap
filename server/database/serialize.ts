/*
 * Conversions between application values and the storage types shared by SQLite and Postgres: JSON and timestamps as
 * text, booleans as 0/1 integers. Reading checks the stored value and names the column when it is invalid.
 */

export class SerializationError extends Error {
  override name = 'SerializationError';
}

/** ISO-8601 UTC with milliseconds and a 4-digit year: sorts chronologically as text. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function toJson(value: unknown): string {
  const text = JSON.stringify(value);
  if (typeof text !== 'string') {
    throw new SerializationError(`Cannot store ${typeof value} as JSON.`);
  }
  return text;
}

export function fromJson(text: string, column: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new SerializationError(`Invalid JSON in ${column}: ${(error as Error).message}`);
  }
}

export function toBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function fromBoolean(value: number, column: string): boolean {
  if (value === 0 || value === 1) {
    return value === 1;
  }
  throw new SerializationError(`Invalid boolean in ${column}: ${String(value)} (expected 0 or 1).`);
}

export function toTimestamp(date: Date): string {
  const text = Number.isNaN(date.getTime()) ? '' : date.toISOString();
  if (!TIMESTAMP.test(text)) {
    throw new SerializationError(`Cannot store an invalid date or a year outside 0000–9999: ${String(date)}.`);
  }
  return text;
}

export function fromTimestamp(text: string, column: string): Date {
  const date = new Date(text);
  // The round trip also rejects impossible dates that Date would silently normalize (e.g. February 30).
  if (!TIMESTAMP.test(text) || Number.isNaN(date.getTime()) || date.toISOString() !== text) {
    throw new SerializationError(`Invalid timestamp in ${column}: "${text}" (expected ISO-8601 UTC with milliseconds).`);
  }
  return date;
}
