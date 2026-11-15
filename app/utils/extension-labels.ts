import type { Translate } from './traffic-graph';
import type { InstalledExtension } from '../../shared/contracts/extensions';
import type { KindEntity } from '@stackmap/extension-sdk';

export interface KindOption {
  value: string;
  label: string;
  icon?: string;
}

export interface ExtensionLabels {
  /** A kind's translated name, or its id when no active extension declares it. */
  kindLabel: (entity: KindEntity, kind: string) => string;
  /** The kinds of an entity across the active extensions, translated, for a select. */
  kindOptions: (entity: KindEntity) => KindOption[];
  entityLabel: (extension: string, entity: string) => string;
  entityPlural: (extension: string, entity: string) => string;
  extensionName: (extension: string) => string;
}

/** Labels from the installed extensions, translated when called: they follow the locale. */
export function extensionLabels(extensions: readonly InstalledExtension[], t: Translate): ExtensionLabels {
  const active = extensions.filter(({ state }) => state === 'active');
  const extension = (id: string) => active.find((candidate) => candidate.id === id);
  const entity = (extensionId: string, entityId: string) =>
    extension(extensionId)?.entities.find(({ id }) => id === entityId);
  const kinds = (of: KindEntity) => active.flatMap((candidate) => candidate.kinds[of]);
  return {
    kindLabel: (of, kind) => {
      const found = kinds(of).find(({ id }) => id === kind);
      return found ? t(found.label) : kind;
    },
    kindOptions: (of) => kinds(of)
      .map(({ id, label, icon }) => ({ value: id, label: t(label), ...(icon ? { icon } : {}) })),
    entityLabel: (extensionId, entityId) => {
      const found = entity(extensionId, entityId);
      return found ? t(found.label) : entityId;
    },
    entityPlural: (extensionId, entityId) => (entity(extensionId, entityId)
      ? t(`extensions.${extensionId}.entitiesPlural.${entityId}`)
      : entityId),
    extensionName: (id) => {
      const found = extension(id);
      return found ? t(found.name) : id;
    },
  };
}
