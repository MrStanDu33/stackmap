# Architecture

This is the target architecture. Parts that are not built yet are marked _(planned)_; the
[roadmap](ROADMAP.md) says when they arrive.

## Overview

Stackmap is one Nuxt 4 application, shipped as one container:

- the **app** (`app/`): Vue 3 pages and components, Nuxt UI, Vue Flow for graphs, and a store for the edit mode's
  state _(planned)_;
- the **server** (`server/`): Nitro API routes (`server/api/`), the domain logic (`server/domain/`), the
  workspace-scoped repositories (`server/repositories/`) and the database layer (`server/database/`);
- **shared code** (`shared/`): code used by both, such as the API contracts and the design rules;
- **built-in extensions** (`extensions/<id>/`): Nuxt layers that add entity types and features;
- the **extension SDK** (`packages/extension-sdk/`).

## Database

Data lives in SQLite by default (`<DATA_DIR>/stackmap.sqlite`) or in Postgres (`DATABASE_URL=postgres://…`), through
Kysely, with one code path for both (`server/database/`):

- the same storage types everywhere: IDs (UUIDv7), JSON and timestamps (ISO-8601 UTC) as text, booleans as 0/1, through
  `serialize.ts`; camelCase tables and columns, like Better Auth's;
- migrations listed in `migrations/index.ts`, each with `up` and `down`, applied at startup before any request is
  served; a database migrated by a newer version is refused; `migrateTo` moves to any migration;
- constraint violations are recognized on both drivers (`errors.ts`: `isUniqueViolation`, `isForeignKeyViolation`),
  so a race between two requests gets the same answer as two requests one after the other;
- extensions bring their own tables through migrations of their own (see Extensions);
- only `server/database/`, the repositories (`server/repositories/`) and extensions' server code query the database,
  and nothing selects every column: a test fails otherwise;
- integration tests run every migration and query on both databases, and check that both end with the same schema;
- search uses a `search_index` table (`server/repositories/search-index.ts`): each entity's title and the text of its
  search fields (declared per type in its repository definition, `search`) and tags, lowercased without accents,
  written in the entity's transaction. A query's words are normalized the same way, `%`, `_` and `\` are escaped, and
  every word must match (`LIKE … escape '\'`, the same on both databases). Titles starting with the query come first;
  entities of extensions turned off in the workspace are left out, and a row whose entity went with another one (a
  cascade) is skipped and deleted. When the search fields change, the index is rebuilt at startup, before the first
  request (`searchIndexVersion` in `appSetting`). `GET /api/workspaces/:id/search` serves it to every member.

## Repository layout

| Path                 | Contents                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| `app/`               | Pages, components (atomic design), CSS tokens, app config                  |
| `server/`            | API routes, domain logic, repositories, database and migrations, auth, CLI |
| `shared/`            | Code shared by the app and the server: contracts, design rules             |
| `extensions/`        | Built-in extensions, each a Nuxt layer; `core` is always on, with entities |
| `packages/`          | The extension SDK: manifests, formats, entity building blocks, server types |
| `i18n/locales/`      | English and French messages                                                |
| `tests/`             | Unit tests that are not next to their code, fixtures, end-to-end tests     |
| `scripts/`           | Convention rules, release tooling and CI checks                            |
| `.storybook/`        | Storybook configuration and foundation pages                               |
| `docs/`              | Product, roadmap, architecture, decisions, CLA, the generated OpenAPI file |

## Domain model

Every entity belongs to a **workspace** and has a status (`planned`, `active` or `deprecated`), tags, markdown notes,
links, custom fields, an origin (`manual` or a connector) and audit fields. The core's entities live in
`extensions/core` (schemas in `entities/`, shared by forms and the server; tables and repositories in `server/`),
built with the SDK's building blocks; IP addresses, networks and DNS names are normalized (IPv6 per RFC 5952,
lowercase DNS names), so equal values are stored the same way.

- A **site** contains **hosts** (physical, VM, LXC, VPS, network device). Hosts have IP addresses on **networks**,
  inside the network's CIDR when it has one.
- A **service** (app, database, cache, DNS, external API…) runs on a host, or on none for an external API, and
  exposes **listeners** (port, transport, protocol, bind address, published port; no bind address for a port only
  reachable on a container network).
- A **domain** (unique in its workspace) has **DNS records**, relative to it (`@`, `www`, `*.dev`). Extensions add
  **proxy routes** and **port forwards** (destination NAT, single ports), then **certificates**, **VPNs** and
  **access policies** (ordered authentication chains) _(planned)_.

- A **flow** is an edge from a source to a listener: a service, or a `public` or `internal` client for traffic that
  enters from outside or inside. Flows added by hand are a core entity (`flow`: source service, target listener,
  protocol, purpose, encryption); removing their service or listener is refused while they exist. **Derived** flows
  are stored in the app's `derived_flow` table and rewritten by the active extensions' **flow derivers** after every
  write, inside the write's transaction and once per transaction, so a write and its flows are committed together.
  The refresh compares by deriver and key: a flow that stays keeps its id. Each deriver runs in a savepoint: one that
  fails, times out (5 s; its later reads are refused) or returns something other than a list of at most 5,000 drafts
  is logged and keeps its stored flows. An invalid draft, a repeated key, or a flow whose source or target is not in
  the workspace is dropped and logged by position (keys may carry names). A write that changed nothing refreshes
  nothing, and the writes of one transaction run one after another, so a blocked removal's savepoint never undoes
  another write. The core derives client entry flows from DNS records (A/AAAA, through the CNAMEs of the same view,
  each name resolved once, to the listeners bound to that address or to every address), the reverse proxy one flow
  per route, and NAT one flow per port forward and listener it reaches (by its published port or port), named by
  the records of the external address, or by none: a forwarded port is exposed either way. The flow is public, or
  internal when the external address is private, carrier-grade NAT or loopback. A forward reaches the hosts holding
  its internal address on one of the forwarding host's networks, the forwarding host itself, or any holder when no
  network is documented; a forward whose host no longer holds its external address gives nothing. The core exports
  the shared rules (`listenerIndex`, `reachableListeners`, `dnsNamesByAddress`, which resolves each name once per
  CNAME budget) from `@stackmap/extension-core/flows`. Access policies and VPNs come with their extensions _(planned)_.
- The **traffic graph** (`GET /api/workspaces/:workspaceId/traffic`) gives a workspace's hosts, services, listeners
  and every stored flow, from a client or a service to a listener, for the Traffic view, which nests services in their
  host and ends each flow on its listener's port. It is built on each request by `server/domain/traffic.ts`, sorted
  (hosts and services by name, listeners by service then port, derived flows before manual ones) and capped (500
  hosts, 1,000 services, 2,000 listeners, 5,000 flows, 10 hostnames per flow with their count); a capped list sets
  `truncated`, and whatever refers to an item left out is left out too, so every reference resolves. Flow bases are
  not read: the graph does not describe hops.
- A **trace** follows the stored flows for a hostname, from a `public` or `internal` client
  (`GET /api/workspaces/:workspaceId/trace`), computed on each request by `server/domain/trace.ts`. Entry flows are
  the client's flows serving the name (exact names win over wildcards, as in DNS), narrowed to a port when one is
  given (a forward's external port, else the listener's published port). From each listener on the request path,
  its service's flows serving the name continue the request, except one back to the listener it arrived at (a proxy
  serving the name on its own port); from every listener reached, flows without names (manual ones) are
  dependencies, followed 8 levels deep. A listener is one node, followed once; a step back to a listener on its own
  path is marked as a cycle. The walk stops at 500 nodes or 1,000 steps (`truncated`). Each step's hops come from
  the **trace hop resolvers** of the entities in its flow's basis: the core describes DNS records (the traced name's
  chain), NAT port forwards and the reverse proxy routes. An entity without a resolver, or whose resolver fails,
  times out (5 s), returns an invalid result or labels outside its extension's `extensions.<id>.` keys, gets one
  generic hop counting its entries, logged with its extension; a resolver that failed is not called again in that
  trace. A step keeps at most 200 hops, the last counting those left out. Each table is read once per trace, and
  each resolver call reads through its own frozen reader, refused once the call is over.

_(Planned.)_

- A **plan** is an ordered checklist. A step can link to an entity and turn it from `planned` to `active`. A
  **template** is a reusable plan with an entity blueprint.
- **Custom types** let users define entity types (fields, icon, graph role, relations, trace participation) stored in
  a generic table.

Kinds (host kinds, service kinds, protocols…) are text values validated against the extension registry, so an
extension can add one without a migration. A kind is checked when it is set or changed, so an entity keeps working
when the extension of its kind is turned off. Fields that an extension adds to a core entity live in the extension's
own table _(planned)_.

The **demo stack** (`server/demo/demo-stack.ts`) is a fictional home lab, described with references by name: a home
server behind an edge router, a website and its database behind Nginx Proxy Manager, `homelab.example`. It combines
the extensions' entities, so it belongs to the app; tests use it, and the app seeds it into its demo workspace: when
`/setup` offers it ("Add the demo workspace", checked), and with `STACKMAP_DEMO=true` (or `1`, `yes`, `on`)
`server/plugins/demo.ts` seeds it when the server starts and no workspace has the slug `demo`, before the first request
is served. The workspace and its data are written in one transaction: a seed that fails or is interrupted leaves
nothing, the next start tries again, and the app runs on (at setup, the administrator is created and signed in all the
same). Every instance administrator becomes its owner; seeded at boot before setup, it gets its owner at setup. An
existing `demo` workspace is never touched, but with `STACKMAP_DEMO` a deleted one comes back on the next start.

## Accounts

Accounts are Better Auth's (`server/auth/`): email and password, and an instance role, `admin` or `user` (its admin
plugin), on its own tables (`user`, `session`, `account`, `verification`, created by our migration `0004_auth` on both
databases). Only its server API is used, from our contract routes; its own router is not mounted, so nothing answers
under `/api/auth`, and every account operation is in the API document:

- `/setup` creates the first administrator once (`POST /api/setup`), signs them in and, when asked, adds the demo
  workspace. It is open while no account exists, for `SETUP_TIMEOUT_MINUTES` (15) after each server start; creating
  the administrator claims an app setting first, so of two concurrent requests one wins and the other gets `409`.
- `/login` signs in (`POST /api/session`); a wrong email and a wrong password get the same `401`. Setup and sign-in
  are limited to 5 attempts a minute per client address (`429` with `Retry-After`), counted in the `rateLimit` table
  (counts whose minute has passed are removed); an IPv6 client counts as its /64. The address is the socket's, or with
  `TRUST_PROXY=true` the last `X-Forwarded-For` entry, the one the proxy added, when it is an IP address; sessions
  record the same address. Whatever Better Auth refuses on sign-in (a banned account too) answers the same `401`.
- The session is the `better-auth.session_token` cookie (`__Secure-` prefixed and Secure when `BETTER_AUTH_URL` is
  HTTPS), HTTP-only and `SameSite=Lax`, valid 7 days and renewed daily while used (an expired one is cleared).
  `GET /api/session` says who is signed in; `DELETE /api/session` signs out.
- The instance administrator manages accounts on `/admin/users` (`/api/users`): creates one with a temporary password
  they choose and send privately, gives one a new temporary password (signing it out everywhere), promotes or demotes
  it, and deletes it. The instance always keeps an administrator and every workspace an owner: role changes and
  deletions are our own writes, under a lock on the `appSetting` row `users.lock`, so their checks and the write share
  a transaction (`409 last_admin`, `409 last_owner` naming the workspaces). Better Auth still hashes and sets
  passwords.
- A temporary password must be replaced first. Every account but the first is created marked
  (`user.mustChangePassword`, set in the Better Auth hook that sets the role, so in the same write), and so is one
  given a temporary password. Signed in, it is sent to `/settings/password`, and `defineContractHandler` answers
  `403 password_change_required` to every operation but reading the session, signing out and changing the password
  (`allowedWhilePasswordChange` on the contract), before reading the input. `PUT /api/account/password` changes the
  password with the current one, signs out the other sessions and clears the mark; it is limited per address and per
  account.
- `reset-password <email>`, for a locked-out administrator, gives the account a random temporary password, printed
  once, signs it out everywhere and marks it: `docker compose exec stackmap reset-password <email>`. It is
  `server/cli/reset-password.ts`, bundled with esbuild at build time into `.output/server/cli/reset-password.mjs`
  (next to the server's traced dependencies); the image's wrapper runs it as `PUID:PGID`.
- The secret that signs sessions is `BETTER_AUTH_SECRET`, or one generated once into `DATA_DIR/.auth-secret`, readable
  by its owner only (an empty file is written again); it must be at least 32 characters.
- `defineContractHandler` refuses a change sent by a browser from another origin than `BETTER_AUTH_URL`
  (`403 invalid_origin`; Better Auth's own check belongs to its router, which is not mounted), answers every operation
  with `Cache-Control: no-store`, and checks the caller before reading or checking the input (see Workspaces and
  isolation for the roles): `401` without a session, `403` below the required role. `server/api/routes.test.ts`
  checks every route.
- In the app, a global route middleware sends visitors to `/setup` until an account exists, then to `/login` (with the
  page asked for, kept only when it is a path on this site) until they sign in. Rendered pages are sent with
  `Cache-Control: no-store`, so Back after signing out asks the server again.

## Workspaces and isolation

Every entity belongs to a **workspace** (`workspace` table: name, unique kebab-case slug), created, read and deleted
with `server/repositories/workspaces.ts`; `GET /api/workspaces` lists the caller's. All entity data goes through the repositories of one workspace, which the
server builds from the active extensions' definitions:
`createWorkspaceRepositories(registry.repositories())(db, { workspaceId, actorId, kinds })` (`server/repositories/`):

- every query is limited to the workspace, so another workspace's entity is invisible: reading it gives nothing,
  updating it changes nothing, removing it removes nothing;
- a reference to an entity of another workspace (or to none) fails with a `WorkspaceReferenceError` naming the field,
  and composite foreign keys, `(workspaceId, parentId)` to `(workspaceId, id)`, refuse it in the database too;
- input is validated with the entity schemas, and kinds against the active extensions (`EntityValidationError` with
  every issue); a duplicate unique value is an `EntityConflictError`, removing a referenced entity an
  `EntityInUseError` naming its dependents; routes turn these into Problem Details;
- queries select named columns, never `*`, so a column added for something else never reaches a response;
- a malformed id finds nothing, filters are validated, and the scope is copied and frozen, so changing the caller's
  object afterwards cannot move the repositories to another workspace;
- `repos.transaction(work)` runs the work on one transaction, all or nothing.

A shared test suite (`tests/support/scoped-repository-suite.ts`) runs every repository through the same isolation
checks on both databases, and a test fails when code outside `server/database/`, `server/repositories/` and an
extension's server code queries the database, or when anything selects every column.

A workspace is reachable only by its **members** (`member` table, `server/repositories/members.ts`), each with a role:
`viewer` < `editor` < `admin` < `owner`. The memberships are our own table rather than Better Auth's organization
plugin, which would write the `workspace` table itself, with its own column types; ours go through our repositories,
the same way on both databases. Each contract states who may call it (`requiredRole`): `public`, `signedIn`,
`instanceAdmin`, or a workspace role, which needs a `:workspaceId` in its path. For a workspace role,
`defineContractHandler` looks up the caller's membership before reading the input and hands the route
`input.workspace`, an `AuthorizedWorkspace` only that check can create; routes build its repositories with
`workspaceRepositories(input.workspace)` (`server/utils/workspace.ts`), which takes nothing else, and never from the
path (`server/api/routes.test.ts` fails on a route that reads the id or builds repositories itself). A workspace that does not exist and
one the caller is not a member of give the same `404 workspace_not_found`, so ids cannot be probed; a member below
the role gets `403`. The instance administrator creates workspaces (`POST /api/workspaces`) and owns the ones they
create; setup makes them owner of every workspace that exists then, and the migration that added memberships did the
same for existing instances. They read other workspaces only with `INSTANCE_ADMIN_ALL_WORKSPACES=true`, as owner.

People join through **invitations** (`invitation` table, `server/repositories/invitations.ts`): a workspace admin or
owner creates a link, `/invite/<token>`, valid 7 days and once. It is shown once and only its SHA-256 hash is stored;
inviting the same email again replaces it. An invitation stands only while its inviter may still grant its role:
demoted, gone from the workspace or deleted, the link answers like an unknown one. Opening it tells the workspace,
the role, the email and the inviter. Links **create no accounts**: without proof that someone owns an email, whoever
holds a link could claim that address, and a sign-in afterwards would tell whether it had an account. So accepting
needs the invited account signed in, and accounts are created by the instance administrator (see Accounts); open
registration waits for email verification. Admins invite, re-role, revoke and remove for editors and viewers only;
owners for anyone (`server/domain/member-rules.ts`); every member may leave. Role changes and removals check these
rules on the member's role as read after locking the workspace's row, and never leave a workspace without an owner:
two owners demoting each other at once cannot both go through (`409 last_owner`). Accepting is limited per address
like sign-in. An entitlements service, `can(workspace, feature)` (`server/domain/entitlements.ts`), allows
everything in v1; paid plans will drive it with a license key or a subscription.

## Extensions

Users customise Stackmap with extensions, in the spirit of VS Code or Chromium. The core and the built-in extensions
use the same SDK, which proves it is sufficient; the core itself is the always-on extension `extensions/core`. Users
are responsible for what they install, and Stackmap makes the risk visible: a manifest declares whether the extension
runs code, installing one that does shows a warning, and an update that starts running code is turned off until an
admin approves it again _(install flows: phase 5; community extensions: after v1)_.

- **SDK** (`packages/extension-sdk`, `@stackmap/extension-sdk`): `defineExtension()` validates a manifest when it is
  defined: a kebab-case id (not `app`, `route`, `locale` or `extension`, which the app's hooks use), a semver version,
  the extension `apiVersion` it targets, its name and description as i18n keys under `extensions.<id>.`, an optional
  `onboarding` question (an i18n key there too: what onboarding asks to offer it), an optional icon (a Lucide name, or
  an image in its own `public/extensions/<id>/`; never a remote URL), `alwaysOn`, `dependsOn`, `enhances` (optional
  dependencies), `code` (`server`, `client`), and what it contributes: kinds, entities, hooks,
  locales. `checkExtension()` (`@stackmap/extension-sdk/testing`) checks what a manifest refers to: its keys in
  English and French, placeholders matching English, its namespace, existing icons. Other entry points:
  `/formats` (the bounded string formats the API contracts use too), `/entities` (common entity fields,
  `defineEntitySchema`, IP/CIDR/DNS values) and `/server` (entity repository and migration definitions).
- **Built-in extensions** live in `extensions/<id>/`. Each is a pnpm workspace package and a Nuxt layer, extended by
  `nuxt.config.ts` (pages and components later). Tests check that every package is listed, translated and versioned,
  and that it keeps to its own keys and files. A layer runs code at build time and shares the app's namespace, so only
  reviewed extensions from this repository become layers.
- **Code and hooks**: an extension's server code (`server.ts`, `defineExtensionServer`) has a `setup(context)` and hook
  handlers; its browser code (`client.ts`, `defineExtensionClient`) has hook handlers. The app calls `app:ready` (once
  the database is migrated), `app:close` (before the database closes), and in the browser `app:mounted`,
  `route:changed` and `locale:changed`; server code calls any hook with `useExtensionHooks().callHook()`. An extension
  declares its own hooks (`<id>:<name>`) and calls them through its context; others may handle them if they depend on
  it or enhance it. Handlers run in registry order, each with its own copy of the payload, which is plain JSON (checked
  outside production) so that extension code can later run in another process. A failing handler is logged with its
  extension and the others carry on; so is one that takes over 10 s. Hooks observe; they cannot change the payload or
  cancel the event. An extension's hooks are frozen when it is defined, so it cannot add handlers after the check.
- **Entities**: an extension declares its entity types in its manifest (`contributes.entities`: id, table, label),
  each stored in a table named `<snake_case extension id>_<camelCase name>` (`core_host`, `reverse_proxy_route`). Its
  server code ships their migrations, in a history of its own (`kysely_migration_<prefix>`), and one repository
  definition per entity (`defineEntityRepository`: table, schema, columns, kinds, references, dependents, and
  callbacks for owned rows such as a host's addresses). The server runs the app's migrations, then the active
  extensions' in registry order, so a table can refer to one of an extension it depends on, then their `setup`, all
  before the first request; a failing migration rolls back and turns its extension off with its dependents. The
  server builds the repositories from the definitions and enforces isolation (see Workspaces and isolation);
  extensions type theirs by augmenting `EntityRepositories`, so `repos.hosts.create(…)` is typed. A test checks that
  each built-in extension creates only tables with its prefix, that its migrations go down and back up, and that
  SQLite and Postgres end with the same schema.
- **Registry and failures** (`server/extensions/registry.ts`, started by `server/plugins/00.extensions.ts`): it orders
  extensions dependencies first. An extension that does not fit (missing dependency, cycle, unsupported API version,
  duplicate id, kind, locale, table or repository clash, code declared but not shipped or the reverse, entities and
  repository definitions that do not match, a hook it may not handle, a migration that fails, a `setup` that throws or
  takes over 30 s) is marked failed with its errors and turned off, with its dependents; the
  app keeps running. Only a failed always-on extension stops the server. Failed extensions contribute nothing.
  `kinds(entity)` and `hasKind(entity, id)` validate the kind columns.
- **Kinds** (host, network, service and protocol kinds) are text values stored by id, unique per entity across
  extensions, so an extension adds one without a migration.
- **Locale packs**: an extension may add languages (`contributes.locales`), and several may add the same one. At build
  time, `modules/extension-locales.ts` merges every extension's locale files per language. Only a key's owner (the
  app, or the extension of `extensions.<id>.…`) and the packs that declare the language may translate it, so no other
  extension can reword the app's strings, its warnings included; the owner wins, then the first declaring pack in
  registry order. A key a language does not translate falls back to English, so a pack may lag behind the app.
  English and French stay complete.
- **Diagnostics**: `GET /api/extensions` lists the extensions with their state, kinds, entities and languages (strings
  are i18n keys); `GET /api/workspaces/:id/extensions` adds whether each is on in the workspace, and is what workspace
  pages read. `GET /api/extensions/diagnostics` (admin) adds
  their errors (credentials masked; the logs keep them whole), declared code, hooks provided and handled, and per
  language the coverage, missing keys and conflicts. Logs name the extension (`[extension:<id>]`);
  `STACKMAP_DEBUG=extensions` traces every hook call on the server (handlers, durations, errors), and
  `localStorage['stackmap:debug'] = 'extensions'` does the same in the browser. An icon the app cannot show is left out,
  and `ExtensionIcon` shows a generic fallback icon.

An extension's server code can contribute **flow derivers** (`flowDerivers`, ids unique in the extension): each reads
the workspace through a frozen reader (`get` and `list` only) and returns flow drafts, each checked with the SDK's
`flowDraftSchema` (at most 10,000 hostnames and 10,000 basis entries per flow). It can also contribute **trace hop
resolvers** (`traceHopResolvers`): each describes the basis entities of one entity type as hops (stage `dns`,
`network` or `proxy`, an i18n label and its params, and the port a client connects to, if any), checked with
`traceHopsSchema` (at most 50 hops per call). One extension per entity, which it or one of its dependencies declares:
otherwise it fails.

_(Planned.)_ Extensions will also contribute fields on other extensions' entities, flow types, templates, wizard
questions and themes, and domain events will join the hooks as the features that emit them arrive.

Admins install and remove extensions, and workspace admins and owners turn them on or off at `/w/<slug>/extensions`
(later a permission). A workspace stores only the extensions it turned off (`workspace_extension_disabled`), so a new
extension is on everywhere and a reinstalled one finds its old state. Turning one off turns off what needs it, and
turning one on turns on what it needs, after a confirmation that lists them. Turning one off never deletes data:

1. the confirmation counts its entities and the flows it derives, which stay saved but hidden
   (`GET …/extensions/:id/impact`);
2. its types disappear from the inventory and its kinds from kind selects (an entity that has one keeps it), and its
   entity API answers `409 extension_disabled`, before reading the body;
3. its flow derivers keep running, so its stored flows are current when it comes back;
4. rows of it that a core removal would delete with their owner (a host's port forwards: `ownedBy` in its repository
   definition) block that removal instead, as `entity_in_use`;
5. what it contributes to graphs stays, so paths stay continuous, without its details: Traffic draws its flows dashed and
   muted, said hidden, without their hostnames (`hidden` on each flow); a trace keeps its hops' steps, stages and ports
   but says only that they are hidden (`trace.hop.hidden`). Both are decided on the server;
6. its entities that no stored flow is based on any more are listed on the Extensions page (`…/:id/orphans`, at most 200
   per type; editors and viewers get their count only, as the entity API hides them); admins delete each
   (audit-logged; its extension still off and nothing based on it, checked again in the deletion's transaction) or keep
   it hidden (`workspace_hidden_entity_kept`, cleared when the extension is turned back on).

A new workspace starts with onboarding: creating one opens `/w/<slug>/onboarding`, "What's in your stack?", one
group per optional extension, named by its question (its manifest's `onboarding`, else its name), with a checkbox per
entity type and kind it adds, all unchecked. Checking an item also checks the items of the extensions it needs (free to
uncheck). Continuing turns on every extension with an item checked and what they need, and every other one off, in one
request (`PUT …/extensions`); skipping keeps them all on. The items only help choose: they are not stored. The server
accepts it only while the workspace holds no entity of any extension (`409 workspace_not_empty`), so the demo
workspace and workspaces in use change one extension at a time, as above.

Removing an extension keeps its data by default (hidden, restored on reinstall); "remove and delete data" shows what
will be deleted, asks for confirmation, offers an export and is audit-logged. An extension others depend on cannot be
removed until they are turned off.

## API

Every route is contract-first. A contract (`defineContract` in `shared/contracts/`) holds the method, path, summary,
description, tags (declared in `tags.ts`), required role, Zod schemas for params, query and body (each field described,
with examples), and per response status a description, a schema and examples; `CONTRACTS` lists them all. The route
in `server/api/` implements exactly one contract with `defineContractHandler`, which:

- reads bodies as JSON only (`415 unsupported_media_type` otherwise, since cross-site forms need no CORS preflight)
  and up to 1 MiB (`413 payload_too_large`, refused while reading);
- validates the input and answers `400 validation_failed` with the issues, without running the handler;
- passes the parsed input, typed, to the handler, which returns `{ status, body }` for one of the declared statuses;
- sends the response parsed with its schema, so a field the contract does not declare never leaves the server (a
  loose schema, such as `z.unknown()` or a passthrough object, lets everything under it through, so response
  schemas avoid them and `shared/contracts/responses.lint.test.ts` fails on one); outside production, such a field
  or a response that does not match answers `500 invalid_response`, so contract drift fails in tests; in production,
  a response that does not match answers `500 internal_error` and is logged, never sent unvalidated;
- answers unexpected errors with `500 internal_error`, logging the details without returning them.

Every error is RFC 9457 Problem Details, as `application/problem+json`: `type` (`urn:stackmap:problem:<code>`),
`title`, `status`, `detail`, `instance` (the request path), a stable `code` (listed in `PROBLEMS`) and, for invalid
values, `issues`. The required role is checked before the input (see Accounts); operations that need a session also
document `401 unauthenticated`, and those that need `admin` or `owner` `403 forbidden`.

The OpenAPI 3.1.1 document is generated from the contracts (`zod-openapi`), served at `/api/openapi.json` and committed
as `docs/api/openapi.json`; a test fails when the committed file is stale (`pnpm test:unit -u` updates it). It describes
everything the specification offers that applies: info (summary, conventions, contact, license), the server as
`{scheme}://{host}` (the served document names the instance itself, behind a proxy too), tags, external docs, shared
error responses, every operation's role, examples and errors, and every property. Every string has a maximum length and
an anchored pattern, every array a maximum size, and every value a type (`shared/contracts/ formats.ts`; free text and
one-line text refuse control, invisible and direction-changing characters, which make text read differently than it is),
so responses validate tightly and API security audits (42Crunch) find no open-ended schema. The document requires the
session cookie (`better-auth.session_token`, `shared/contracts/security.ts`) except on public operations, and a test
checks that Better Auth sets that cookie. Tests prove it: it is valid OpenAPI, the strict Redocly lint
(`redocly.yaml`) reports nothing, and every example matches its schema. `/api/docs` renders it with Scalar, bundled in
the app: no CDN, remote fonts, telemetry or AI services.

**The entity API** serves every entity type an active extension declares, from generic routes:
`/api/workspaces/:workspaceId/entities/:extension/:entity` (list, create) and `…/:entityId` (get, update, remove).
`shared/contracts/entities.ts` generates each type's operations from its schemas, tagged with its extension, so the
document describes every type's fields; response schemas drop the refines, which have no OpenAPI form, and entity
schemas normalize with checks and overwrites rather than transforms for the same reason. Reading needs `viewer`,
writing `editor`; the role is checked before the type, so a non-member cannot tell which types exist. Lists are paged
(`limit` up to 1000, `offset`) and answer with the `total`. The route reads only the type's declared fields and leaves
their values to the repository, so a broken rule is `422 entity_invalid`. Every issue has a stable `code` (Zod's,
`unknown-kind`, or an extension's `<extension>.<rule>`) and the `params` its translation needs, cut to the bounds its
contract declares. A reference outside the workspace is `422 reference_invalid` (a foreign key race too, caught in a
savepoint), a duplicate `409 entity_conflict`, a removal others depend on `409 entity_in_use`, and an update that lost
a race `409 entity_changed`; an update that changes nothing writes nothing.

Every entity write records an **audit event** (`audit_event`) in its own transaction: the actor, the action, the
entity and the names of the fields it changed, never their values, which may be secrets. Rows the database deletes
with an entity (a host's port forwards) record no event of their own _(planned)_.

`GET /api/health` answers `200` with the app version when the database answers, `503` otherwise; the Docker
healthcheck calls it. The database error goes to the logs, never to the response.

_(Planned, team-ready milestone.)_ Pipelines (CI jobs, Terraform, Ansible) will write through the same API with
**scoped API tokens** (a workspace and a role per token, revocable) and an **idempotent apply** operation that
upserts entities by an external key, so a repeated run creates no duplicates. Both belong to the core, since they
are authentication and a generic need; mapping a tool's output to entities belongs to one extension per tool, and the
tools that run in a pipeline live outside the app. If extensions ever contribute routes of their own, an admin
setting will turn that API off.

## Interface

- Components follow atomic design: atoms, molecules, organisms, templates; Nuxt pages are the pages level. Each
  component has stories, run as tests in Chromium in every theme, contrast mode and locale. Storybook uses the plain
  Vue + Vite framework with small Nuxt shims, because the Nuxt Storybook framework does not support Nuxt 4.6 yet.
- Design tokens live in `app/assets/css/tokens.css`: the nebula and midnight palettes and the semantic Nuxt UI tokens
  for the midnight (default) and light themes, each in standard and strict contrast. `shared/design/contrast.ts`
  defines the contrast requirements, checked by tests.
- Every string is in English and French (`@nuxtjs/i18n`, no locale in URLs).
- Icons are Lucide (`i-lucide-…`), bundled with the app (`@iconify-json/lucide`): the Iconify API is never called, so
  the app works offline and tells no third party where it runs.
- Accessibility targets RGAA 4.1 (based on WCAG 2.1 AA) plus the success criteria WCAG 2.2 AA added: focus not
  obscured (2.4.11), dragging movements (2.5.7: every drag has a single-pointer alternative, which the edit mode
  needs), target size of at least 24 px (2.5.8), consistent help (3.2.6), redundant entry (3.3.7) and accessible
  authentication (3.3.8: sign-in allows pasting and password managers). RGAA 5, based on WCAG 2.2, replaces this
  when it is published. The strict mode raises contrast to AAA, removes motion, keeps focus visible and enlarges
  targets. Asking the system for reduced motion removes motion too. Every graph has an accessible table equivalent.
- Every page sits in the `AppShell` template: a skip link, the `AppSidebar` (only the sections that exist; a drawer
  on narrow screens) with the display preferences (theme, contrast, language), and the main landmark. The shell holds
  the page's one live region and alert, for preference saves and a notice a page leaves for the next one.
- Preferences follow the account: theme, contrast, language and landing page (Traffic or Trace, which `/` opens) are
  saved in `userPreference`, each `null` until chosen, and come with the session. They are applied on sign-in and on
  each load and written to the cookies server rendering reads (color mode's cookie, `stackmap_contrast`,
  `stackmap_locale`), so the page is right from its first paint; signed in, a change is saved to the account
  (`app/plugins/preferences.client.ts`), signed out it stays in the cookies. `/settings` shows them with the password
  change.
- Workspaces are in the URL: `/w/<slug>/graph` and `/w/<slug>/trace`, so links and bookmarks open the same one. The
  sidebar's switcher (`WorkspaceSwitcher`, a non-modal menu of links kept in the sidebar's landmark) lists the
  user's workspaces with their role and keeps the view; the instance administrator also gets `/workspaces/new`.
  `useWorkspaces()` fetches the list once on the client, shared by every page, and remembers the last workspace
  opened in the `stackmap-workspace` cookie (its slug only). `/`, `/graph` and `/trace` lead to that one, or the first
  by name, with the same query; without any, they say how to get one. A slug that is unknown or not the user's shows
  the same "Workspace not found" page.
- `/w/<slug>/members` lists the members (`MembersTable`) for everyone, with the controls the caller's role allows and
  a confirmation before removing, leaving or revoking; admins and owners also invite (`InviteForm`, the link shown
  once with Copy) and see the pending invitations. `/invite/<token>` (open signed out, `InvitationCard`) offers to
  sign in with the invited account, then to accept.
- The Traffic view (`/w/<slug>/graph`) draws `GET /api/workspaces/:workspaceId/traffic` with Vue Flow:
  hosts hold their services, services list their ports, and each flow ends on its port. ELK lays it out in a web
  worker (`app/composables/useTrafficLayout.ts`, from the pure helpers in `app/utils/traffic-graph.ts`). Nodes are
  buttons with a pressed state, names that start with their visible text and role descriptions in the current
  language (Vue Flow's own English keyboard help is turned off, the graph is read-only); a node that gets focus off
  the canvas is panned into view, and outlines keep their width whatever the zoom. The wheel scrolls the page; the
  buttons zoom. `?view=list` shows the same data as tables, one per host. Selecting a host, service, port or flow opens
  the detail panel and highlights its flows, thicker and solid against dimmed and dashed ones; a live region
  announces it (events only: the counts on load, then each selection), following a link inside the panel moves focus
  to its title, and Escape closes the panel and returns focus unless another widget used it.
- The Trace view (`/w/<slug>/trace`) draws `GET /api/workspaces/:workspaceId/trace` for a hostname, a client and an optional
  port, all kept in the URL (checked with the route's own query schema before any request). The path runs left to
  right: the client, each listener the request reaches, then the dependencies; steps are edges, solid for the
  request, dashed for dependencies, dotted for cycles, and every step's hops are the extensions' translated sentences
  (a missing translation reads "{entity}: no description"). `?view=list` shows the ordered steps with their hops as
  the accessible equivalent, and the detail panel shows a step's hops in order or a listener's steps in and out. Both
  graphs share their layout code (`useElkLayout`, ELK in a worker) and their conventions. A selected step's panel
  walks the trace with Previous and Next in the list's order (the request, then the dependencies by level); the graph
  pans to the step and the list scrolls to it. The selection is kept in `?selected=` (`step:<id>`, `listener:<id>` or
  `client`), replaced rather than pushed, and dropped when it is not in the trace.
- The Traffic view's panel links to traces: a flow's exact names, and the names of the flows reaching a port or
  service, each traced from its flow's client (from the Internet for a flow between services). Wildcards are not
  linked, since the trace route refuses them.
- The inventory (`/w/<slug>/inventory/<extension>/<entity>`, `/w/<slug>/inventory` opening the first type) lists each
  entity type an active extension declares and registers. An extension registers its types with `defineInventory`
  (`extensions/<id>/app/inventory.ts`, listed in `app/extensions/inventory.ts`): each type's hand-written form, a
  component of the extension's Nuxt layer loaded with its type, its table columns (text, number, kind, reference, enum,
  list, boolean as Yes/No, and endpoint: an address and its port field as `203.0.113.10:443`), an optional title (a
  listener reads "<service> :<port>/<transport>") and the types its form chooses from. Enum labels sit under the
  extension's keys or a dependency's (port forwards use the core's transports). Reference options carry the referenced
  row, so a form can offer its fields: a port forward picks its external address among its host's addresses.
  `EntityTable` loads up to 1000 entities per type and sorts, searches, filters (status, kind) and pages them in the
  browser, with the query in the URL; beyond 1000 it says it shows the first ones (the search index serves the command
  palette, not the tables). Editors create, edit and delete in `EntitySlideover` and `DeleteEntityDialog` through the
  entity API: an edit sends only the changed fields, validation issues are translated from their codes under their
  fields and in a summary linked to them (an issue on a row the form does not show, such as a list edited as text, links
  to its list), and the other refusals (changed, gone, in use, forbidden) are said in place. Outcomes are announced in
  the table's live region once the slide-over or dialog has closed and focus has moved, since a modal hides the page
  from assistive technologies; viewers read entities as text and links.
- Kinds, entity names and extension names are translated from the installed extensions (`GET /api/extensions`,
  loaded once into shared state by `useExtensions()`, read through `useExtensionLabels()`), falling back to the raw
  id: in the inventory and in the Traffic and Trace views, visible text and accessible names alike.
- Solid buttons keep their background on hover and press and underline their label instead (`app/app.config.ts`):
  Nuxt UI's faded hover drops the label below 4.5:1 on the midnight theme. Warnings use the outline alert for the
  same reason in the light theme.

## Testing

Tests are the specification: acceptance criteria are written as test names before the code. Layers: unit tests
(Vitest), integration tests against SQLite and Postgres, stories as component tests, Docker image smoke tests, and
end-to-end tests with Playwright and axe against the built app (one server seeded with the demo workspace, one
without). Coverage thresholds and nightly mutation testing guard the domain
logic. Test data comes from factories (the core's in `extensions/core/testing`, for its tests and those of the
extensions built on it) and the demo stack, with fictional values only (documentation and private IP ranges,
`.example` names), which tests check. On Postgres, each test gets its own schema, in a database of its Vitest worker.
Story tests pass or fail on the code alone, never on the machine's speed: their waits (10 s) and clock (120 s) only
stop a hung story, no story sets a timeout of its own, the browser prefers reduced motion so nothing animates, and
each project opens one page. A nightly flake hunt (`pnpm test:stories:hunt`) runs them 5 times shuffled, overloaded
and never retried; a story it catches is fixed at its cause, from the seed it prints. See
[CONTRIBUTING.md](../CONTRIBUTING.md).

| Layer            | What it proves                                                  | Where                                    | Command                                   | Blocks a merge   |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------- | ---------------- |
| Static           | Types, lint rules (including accessibility rules), CSS          | everywhere                               | `pnpm lint`, `pnpm lint:css`, `pnpm typecheck` | yes         |
| Unit             | Pure logic, contracts, conventions scripts                      | next to the code (`*.test.ts`), `tests/unit/` | `pnpm test:unit`                     | yes              |
| Integration      | Routes, repositories, migrations on SQLite and Postgres         | `*.integration.test.ts`                  | `pnpm test:integration`                   | yes, with coverage |
| Stories          | Component behavior (play functions) and axe, per theme × contrast × locale | `*.stories.ts`                | `pnpm test:stories`                       | yes              |
| End-to-end       | User journeys, keyboard, axe on the built app, with and without the demo | `tests/e2e/`                    | `pnpm build && pnpm test:e2e`             | not yet: see below |
| Smoke            | The Docker image starts, migrates and becomes healthy           | `tests/smoke/`                           | `pnpm test:smoke`                         | in the Docker workflow |
| Mutation         | Tests catch changes in the domain, `shared/` and pure DB code   | `stryker.config.*`                       | `pnpm test:mutation`                      | nightly          |
| Flake hunt       | Stories pass shuffled and under load                            | stories                                  | `pnpm test:stories:hunt`                  | nightly          |

`pnpm test` runs the Vitest projects (unit, integration, stories), not end-to-end or smoke tests. Coverage: 80%
overall, 90% for domain, database, repository, SDK and extension server and entity code; `vitest.config.ts` is the
source of truth.

> OPEN: end-to-end tests, CodeQL and dependency review run on every pull request but are not required checks yet;
> making them required is planned.

A change to a page or a layout is also checked in a browser before it is done: the page opened on the dev server,
used with the keyboard, in each theme, in strict mode and in French. Stories and end-to-end tests prove behavior; this
catches what passes but looks wrong.

## Security and privacy

Stackmap stores a map of an organization's attack surface, so it is designed as if its database could leak (see the
principle in [PRODUCT.md](PRODUCT.md#principles)):

- store the minimum; never store secrets of the documented infrastructure; connector credentials, when they arrive,
  are encrypted at rest _(planned)_;
- every query is scoped to a workspace and every route checks the caller's role (see Workspaces and isolation);
  audit events record field names, never values;
- the app calls no third-party service (icons and API docs are bundled, fonts are the system's), sends no
  telemetry, and runs no third-party code in its process or the browser;
- exports and screenshots can be redacted, and the app warns when it is reachable from the internet _(planned)_.

**Threat model.** What each attacker gets today, and what stops them:

| Threat                                        | What it gets today                         | What stops it                                                        |
| --------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| A stolen database file or backup              | Every workspace, in plain text             | Nothing yet: encryption at rest is to be decided (below)             |
| A compromised server (remote code execution)  | Everything, including any key it holds     | Nothing at rest; patching, the image's scans, least privilege       |
| A stolen session                              | The victim's workspaces, at their role     | HTTP-only cookies, expiry, sign-out everywhere; later TOTP and OIDC   |
| A malicious or careless workspace member      | Their workspace, at their role             | Roles; history and audit _(planned, team-ready)_                     |
| Another workspace's member probing ids        | Nothing                                    | Workspace-scoped repositories, the same 404 for missing and forbidden |
| Injection (SQL, markup, headers)              | Nothing known                              | Kysely parameters, bounded and validated input, contract-checked output |
| A malicious extension                         | What the app process can reach             | Only reviewed built-in extensions run code; third-party ones out of process _(planned)_ |
| A leaked connector credential                 | The connected tool, at the token's scope   | Read-only, least-privilege tokens, encrypted at rest _(planned)_     |

> OPEN: encryption of the data at rest (the whole database file or volume, or chosen fields decrypted for search in
> memory) is decided from this table before the team-ready milestone starts. Encrypting fields so the database
> cannot match them would break partial-match search, which the command palette relies on.

## Glossary

| Term            | Meaning                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| Workspace       | An isolated set of infrastructure data, shared by its members                                 |
| Site            | A physical or logical location: a home, a datacenter, a cloud region                          |
| Host            | A machine: physical server, VM, container host, VPS or network device                         |
| Service         | Software running on a host: an app, a database, a reverse proxy…                              |
| Listener        | A port a service listens on, with its protocol and bind address                               |
| Flow            | A connection from a service to a listener                                                     |
| Hop             | One step of a trace: DNS, NAT, proxy, app, dependency                                         |
| Trace           | The computed path of a request to a hostname, hop by hop                                      |
| Exposure        | How reachable a service is: internal, VPN only, public behind authentication, public          |
| Access policy   | An ordered chain of authentication and access controls in front of a service                  |
| Plan            | A checklist to deploy or change something, whose steps can create and activate entities       |
| Template        | A reusable plan with the entities it creates                                                  |
| Extension       | A module that adds types and features; built-in, custom (declarative) or external             |
| Custom type     | An entity type defined by users in the interface                                              |
| Strict mode     | The RGAA strict accessibility setting: AAA contrast, no motion, visible focus, large targets  |
