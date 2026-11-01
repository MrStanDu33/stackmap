import { listWorkspaces } from '../../../shared/contracts/workspaces';
import { allWorkspaces, workspacesOf } from '../../repositories/members';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';
import { isOn } from '../../utils/flags';

export default defineContractHandler(listWorkspaces, async ({ session }) => {
  const db = await useDatabase();
  const workspaces = session.user.role === 'admin' && isOn(process.env.INSTANCE_ADMIN_ALL_WORKSPACES)
    ? (await allWorkspaces(db)).map((workspace) => ({ ...workspace, role: 'owner' as const }))
    : await workspacesOf(db, session.user.id);
  return {
    status: 200,
    body: {
      workspaces: workspaces.map((workspace) => ({
        ...workspace, createdAt: workspace.createdAt.toISOString(), updatedAt: workspace.updatedAt.toISOString(),
      })),
    },
  };
});
