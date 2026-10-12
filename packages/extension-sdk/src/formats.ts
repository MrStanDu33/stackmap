import { z } from 'zod';

const unimplemented = (_maxLength: number) => z.never() as unknown as z.ZodString;

export const text = unimplemented;
export const line = unimplemented;
