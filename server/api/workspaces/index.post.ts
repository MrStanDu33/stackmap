import { getRequestURL } from 'h3';

import { problemOf } from '../../../shared/contracts/errors';
import { createWorkspace } from '../../../shared/contracts/workspaces';
import { EntityConflictError } from '../../repositories/errors';
import { createOwnedWorkspace } from '../../repositories/members';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';

/** Creates an empty workspace, owned by the instance administrator who asks. */
export default defineContractHandler(createWorkspace, async ({ body, session }, event) => {
  try {
    const db = await useDatabase();
    const { createdAt, updatedAt, ...workspace } = await createOwnedWorkspace(db, body, session.user.id);
    return {
      status: 201,
      body: { ...workspace, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() },
    };
  } catch (error) {
    if (!(error instanceof EntityConflictError)) {
      throw error;
    }
    return {
      status: 409,
      body: problemOf('workspace_slug_taken', {
        detail: `A workspace already uses the slug ${body.slug}.`,
        instance: getRequestURL(event).pathname,
      }),
    };
  }
});
