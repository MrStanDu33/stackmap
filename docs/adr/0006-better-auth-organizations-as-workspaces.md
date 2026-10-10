# 6. Better Auth organizations as workspaces

- Status: accepted
- Date: 2026-10-10

## Context

Data is scoped by workspace, with members, roles and invitations. Better Auth handles accounts and sessions, and its
organization plugin already models organizations, members, invitations and access control.

## Decision

- Workspaces are Better Auth **organizations**, with custom roles `owner`, `admin`, `editor` and `viewer` defined
  through its access control.
- Email and password, and the admin plugin, in v1. 2FA, OIDC and passkeys are plugins added later.
- Our own tables (entities, settings, audit events) reference the organization ID as `workspaceId`.

## Consequences

- No parallel workspace, membership or invitation model to maintain.
- Upgrades of Better Auth can change its schema; its migrations are generated into ours and reviewed.
