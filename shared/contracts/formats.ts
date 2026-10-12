import { z } from 'zod';

// Bounded formats for the API's strings: every string has a maximum length and an anchored pattern, so responses
// can be validated tightly (outside production, and by API security tools such as 42Crunch).

/**
 * Free text: anything but control characters (tabs and line breaks allowed), and invisible or direction-changing
 * characters that make text read differently than it is (zero-width spaces, bidi overrides and isolates, BOM). The
 * zero-width joiner stays, for emoji sequences.
 */
// eslint-disable-next-line no-control-regex -- the point is to refuse control characters.
export const TEXT = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]*$/;
/** One line of text: no control characters at all (no tabs or line breaks either), and nothing `TEXT` refuses. */
// eslint-disable-next-line no-control-regex -- the point is to refuse control characters.
export const LINE = /^[^\u0000-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]*$/;
export const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** A semantic version: 1.4.0, 2.0.0-beta.1. */
export const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** An i18n key: `extensions.core.kinds.host.vm`. */
export const I18N_KEY = /^[A-Za-z][\w-]*(?:\.[\w-]+)*$/;
/** `de`, `pt-BR`, `zh-Hant`. */
export const LOCALE_CODE = /^[a-z]{2,3}(?:-[A-Z]{2}|-[A-Z][a-z]{3})?$/;
/** A BCP 47 tag: `de-DE`. */
export const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
/** A hook: `app:ready`, `vpn:peer-added`. */
export const HOOK = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
/** A Lucide icon, or an image an extension ships. */
export const ICON = /^(?:i-lucide-[a-z0-9]+(?:-[a-z0-9]+)*|\/extensions\/[a-z0-9-]+\/[\w/-]+\.(?:svg|png|webp))$/;
export const HTTP_URL = /^https?:\/\/\S+$/;
/** A request path. */
export const PATH = /^\/[\x21-\x7E]*$/;
/** A name in a map of the OpenAPI document (schemas, responses, variables…). */
export const NAME = /^[A-Za-z][\w.-]*$/;

export const text = (maxLength: number) => z.string().max(maxLength).regex(TEXT);
export const line = (maxLength: number) => z.string().max(maxLength).regex(LINE);
export const kebabId = () => z.string().max(40).regex(KEBAB_CASE);
export const semver = () => z.string().max(64).regex(SEMVER);
export const i18nKey = () => z.string().max(200).regex(I18N_KEY);
export const icon = () => z.string().max(200).regex(ICON);
export const httpUrl = () => z.string().max(2048).regex(HTTP_URL);
export const name = () => z.string().max(100).regex(NAME);
