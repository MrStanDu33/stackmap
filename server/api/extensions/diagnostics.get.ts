import { ExtensionDiagnostics, getExtensionDiagnostics, MAX_HOOK } from '../../../shared/contracts/extensions';
import { defineContractHandler } from '../../utils/contract-handler';
import { useExtensionRegistry } from '../../utils/extensions';

/** The contract's limits; the startup log keeps every error. */
const MAX_ERRORS = 50;
const MAX_HANDLED = 100;

const capped = (errors: readonly string[]) => (errors.length > MAX_ERRORS
  ? [...errors.slice(0, MAX_ERRORS - 1), `… and ${String(errors.length - MAX_ERRORS + 1)} more errors (see the server logs)`]
  : [...errors]);

/** For admins, extension authors and maintainers: what each extension does, why it failed, translation coverage. */
export default defineContractHandler(getExtensionDiagnostics, () => {
  // The translation report is built with the app (modules/extension-locales.ts) into the runtime config.
  const languages = ExtensionDiagnostics.shape.languages.parse(useRuntimeConfig().extensionLocales.languages);
  return {
    status: 200,
    body: {
      extensions: useExtensionRegistry().extensions.map(({ manifest, state, errors, server }) => ({
        id: manifest.id,
        version: manifest.version,
        state,
        errors: capped(errors),
        code: { server: manifest.code?.server ?? false, client: manifest.code?.client ?? false },
        hooks: {
          provides: (manifest.contributes.hooks ?? []).map(({ name }) => `${manifest.id}:${name}`),
          // As its code names them, valid or not (a misnamed hook is why the extension failed), within the contract.
          handles: Object.keys(server?.hooks ?? {})
            .map((hook) => hook.replace(/[^\x21-\x7E]/g, '?').slice(0, MAX_HOOK))
            .filter((hook) => hook !== '')
            .slice(0, MAX_HANDLED),
        },
      })),
      languages,
    },
  };
});
