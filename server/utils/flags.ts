/** Values of an on/off environment variable that turn it on, in any case. Anything else is off. */
const ON = new Set(['true', '1', 'yes', 'on']);

export const isOn = (value: string | undefined): boolean => ON.has(value?.trim().toLowerCase() ?? '');
