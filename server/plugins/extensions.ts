import { BUILTIN_EXTENSIONS } from '../extensions/builtin';
import { createExtensionRegistry } from '../extensions/registry';
import { setExtensionRegistry } from '../utils/extensions';

/**
 * Builds the extension registry when the server starts. If the extensions do not fit together, the process exits so
 * the container restarts with every problem in its logs.
 */
export default defineNitroPlugin(() => {
  try {
    setExtensionRegistry(createExtensionRegistry(BUILTIN_EXTENSIONS));
  } catch (error) {
    console.error(`[extensions] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
});
