import { refreshDerivedFlows } from './derived-flows';
import { createEntityRepository, inTransaction } from './entity-repository';
import { loggerFor } from '../extensions/runtime';

import type { Database } from '../database/types/schema';
import type { RegisteredFlowDeriver } from '../extensions/registry';
import type { ExtensionLogger, KindEntity } from '@stackmap/extension-sdk';
import type {
  EntityRepositories, EntityRepositoryDefinition, FlowReader, RepositoryScope,
} from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** The repositories of one workspace: the only way to read or write its entities. */
export type WorkspaceRepositories = EntityRepositories & {
  /** Runs the work with repositories of the same workspace on one transaction: all of it is kept, or none. */
  transaction: <T>(work: (repos: WorkspaceRepositories) => Promise<T>) => Promise<T>;
};

/**
 * Builds the repositories of the active extensions' entities, under each definition's key. The scope is copied and
 * frozen: changing the caller's object afterwards cannot move them to another workspace.
 */
export interface WorkspaceRepositoriesOptions {
  /** Run after every write, at the end of the outermost transaction, to refresh the derived flows. */
  flowDerivers?: readonly RegisteredFlowDeriver[];
  /** The logger of a deriver's extension, for its failures. */
  logger?: (extension: string) => ExtensionLogger;
  deriverTimeoutMs?: number;
}

const WRITES = ['create', 'update', 'remove'] as const;

type Write = (typeof WRITES)[number];

type Repository = Record<Write | 'get' | 'list', (...args: unknown[]) => Promise<unknown>>;

/** The same repository in the repositories of a transaction. */
function repositoryOf(repos: WorkspaceRepositories, key: string): Repository {
  const repository = (repos as unknown as Partial<Record<string, Repository>>)[key];
  if (!repository) {
    throw new Error(`No repository ${key}.`);
  }
  return repository;
}

/** Whether the outermost transaction wrote something, so the derived flows need a refresh before it commits. */
interface Session {
  wrote: boolean;
}

/**
 * Builds the repositories of the active extensions' entities, under each definition's key. The scope is copied and
 * frozen: changing the caller's object afterwards cannot move them to another workspace. With flow derivers, every
 * write runs in a transaction that refreshes the workspace's derived flows before it commits.
 */
export function createWorkspaceRepositories(
  definitions: readonly (EntityRepositoryDefinition & { tableOwners?: readonly string[] })[],
  { flowDerivers = [], logger = loggerFor, deriverTimeoutMs }: WorkspaceRepositoriesOptions = {},
): (db: Kysely<Database>, scope: RepositoryScope) => WorkspaceRepositories {
  const factories = definitions.map((definition) => [definition.key, createEntityRepository(definition)] as const);
  const plain = (db: Kysely<Database>, scope: RepositoryScope) => Object.fromEntries(
    factories.map(([key, factory]) => [key, factory({ db, scope }) as unknown as Repository]),
  );
  const refresh = (trx: Kysely<Database>, scope: RepositoryScope) => {
    const read = Object.fromEntries(Object.entries(plain(trx, scope))
      .map(([key, { get, list }]) => [key, { get, list }]));
    return refreshDerivedFlows(trx, scope.workspaceId, {
      derivers: flowDerivers, read: read as unknown as FlowReader, logger, timeoutMs: deriverTimeoutMs,
    });
  };

  /** Inside a session, writes mark it; outside, each write is its own transaction, with its refresh. */
  const build = (db: Kysely<Database>, scope: RepositoryScope, session?: Session): WorkspaceRepositories => {
    const transaction: WorkspaceRepositories['transaction'] = (work) => {
      if (session) {
        return work(build(db, scope, session));
      }
      return inTransaction(db, async (trx) => {
        const inner: Session = { wrote: false };
        const result = await work(build(trx, scope, inner));
        if (inner.wrote) {
          await refresh(trx, scope);
        }
        return result;
      });
    };
    const write = (key: string, method: Write, repository: Repository) => (session
      ? async (...args: unknown[]) => {
        const result = await repository[method](...args);
        session.wrote = true;
        return result;
      }
      : (...args: unknown[]) => transaction((repos) => repositoryOf(repos, key)[method](...args)));
    const repositories = Object.fromEntries(Object.entries(plain(db, scope)).map(([key, repository]) => [
      key,
      flowDerivers.length === 0
        ? repository
        : { ...repository, ...Object.fromEntries(WRITES.map((method) => [method, write(key, method, repository)])) },
    ]));
    return { ...repositories, transaction } as WorkspaceRepositories;
  };

  return (db, scope) => {
    // The callbacks of definitions get the scope: kinds answer hasKind and nothing else of the registry.
    const { kinds } = scope;
    const frozen: RepositoryScope = Object.freeze({
      ...scope,
      kinds: Object.freeze({ hasKind: (entity: KindEntity, id: string) => kinds.hasKind(entity, id) }),
    });
    return build(db, frozen);
  };
}
