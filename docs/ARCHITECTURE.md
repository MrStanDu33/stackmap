# Architecture

This is the target architecture. Parts that are not built yet are marked _(planned)_; the
[roadmap](ROADMAP.md) says when they arrive.

## Overview

Stackmap is one Nuxt 4 application, shipped as one container:

- the **app** (`app/`): Vue 3 pages and components, Nuxt UI, Vue Flow for graphs, Pinia for editor state;
- the **server** (`server/`): the database layer (`server/database/`), and later Nitro API routes and the domain
  logic;
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
- integration tests run every migration and query on both databases, and check that both end with the same schema.

## Repository layout

| Path                 | Contents                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| `app/`               | Pages, components (atomic design), CSS tokens, app config                  |
| `server/`            | API routes, database and migrations; later domain logic and repositories   |
| `shared/`            | Code shared by the app and the server: contracts, design rules             |
| `extensions/`        | Built-in extensions, each a Nuxt layer; `core` is always on, with entities |
| `packages/`          | The extension SDK: manifests, formats, entity building blocks, server types |
| `i18n/locales/`      | English and French messages                                                |
| `tests/`             | Unit tests that are not next to their code, fixtures, end-to-end tests     |
| `scripts/`           | Convention rules, release tooling and CI checks                            |
| `.storybook/`        | Storybook configuration and foundation pages                               |
| `docs/`              | Roadmap, architecture, CLA, the generated OpenAPI document                 |

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
  CNAME budget) from `@stackmap/extension-core/flows`. Access
  policies, VPNs and NAT come with their extensions _(planned)_.

_(Planned.)_

- A **trace** is computed for a hostname: client → DNS → public IP, NAT or tunnel → proxy → upstream → dependencies.
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
the extensions' entities, so it belongs to the app; tests use it, and the app seeds it into its demo workspace.

## Workspaces and isolation

Every entity belongs to a **workspace** (`workspace` table: name, unique kebab-case slug), created, read and deleted
with `server/repositories/workspaces.ts`. All entity data goes through the repositories of one workspace, which the
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

Members, roles (`owner`, `admin`, `editor`, `viewer`) and invitations come from Better Auth's organization plugin,
mapped onto the `workspace` table _(planned, phase 4)_. An entitlements service, `can(workspace, feature)`, allows
everything in v1 and prepares paid plans _(planned)_.

## Extensions

Users customise Stackmap with extensions, in the spirit of VS Code or Chromium. The core and the built-in extensions
use the same SDK, which proves it is sufficient; the core itself is the always-on extension `extensions/core`. Users
are responsible for what they install, and Stackmap makes the risk visible: a manifest declares whether the extension
runs code, installing one that does shows a warning, and an update that starts running code is turned off until an
admin approves it again _(install flows: phase 5; community extensions: after v1)_.

- **SDK** (`packages/extension-sdk`, `@stackmap/extension-sdk`): `defineExtension()` validates a manifest when it is
  defined: a kebab-case id (not `app`, `route`, `locale` or `extension`, which the app's hooks use), a semver version,
  the extension `apiVersion` it targets, its name and description as i18n keys under `extensions.<id>.`, an optional
  icon (a Lucide name, or an image in its own `public/extensions/<id>/`; never a remote URL), `alwaysOn`, `dependsOn`,
  `enhances` (optional dependencies), `code` (`server`, `client`), and what it contributes: kinds, entities, hooks,
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
  are i18n keys; `enabled` is `true` until the per-workspace toggles). `GET /api/extensions/diagnostics` (admin) adds
  their errors (credentials masked; the logs keep them whole), declared code, hooks provided and handled, and per
  language the coverage, missing keys and conflicts. Logs name the extension (`[extension:<id>]`);
  `STACKMAP_DEBUG=extensions` traces every hook call on the server (handlers, durations, errors), and
  `localStorage['stackmap:debug'] = 'extensions'` does the same in the browser. An icon the app cannot show is left out,
  and `ExtensionIcon` shows a generic fallback icon.

An extension's server code can contribute **flow derivers** (`flowDerivers`, ids unique in the extension): each reads
the workspace through a frozen reader (`get` and `list` only) and returns flow drafts, each checked with the SDK's
`flowDraftSchema` (at most 1,000 hostnames and 1,000 basis entries per flow).

_(Planned.)_ Extensions will also contribute fields on other extensions' entities, flow types, **trace hop resolvers** (resolve the next hop through its entities), templates, wizard
questions and themes, and domain events will join the hooks as the features that emit them arrive.

Admins install and remove extensions, and workspace admins turn them on or off _(planned, phase 5; who may do it is a
permission)_. Turning one off never deletes data:

1. if its entities carry live flows, the admin is warned first;
2. its types disappear from palettes, forms, search and filters;
3. its entities that are still connected show as greyed "hidden" boxes in graphs and traces, so paths stay continuous;
4. once a hidden entity has no connection left, the user chooses to delete it or keep it hidden.

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
values, `issues`. The required role is recorded now and enforced from phase 4.

The OpenAPI 3.1.1 document is generated from the contracts (`zod-openapi`), served at `/api/openapi.json` and committed
as `docs/api/openapi.json`; a test fails when the committed file is stale (`pnpm test:unit -u` updates it). It describes
everything the specification offers that applies: info (summary, conventions, contact, license), the server as
`{scheme}://{host}` (the served document names the instance itself, behind a proxy too), tags, external docs, shared
error responses, every operation's role, examples and errors, and every property. Every string has a maximum length and
an anchored pattern, every array a maximum size, and every value a type (`shared/contracts/ formats.ts`; free text and
one-line text refuse control, invisible and direction-changing characters, which make text read differently than it is),
so responses validate tightly and API security audits (42Crunch) find no open-ended schema. The document requires the
session cookie (`better-auth.session_token`, `shared/contracts/security.ts`) except on public operations; it is enforced
once accounts exist (phase 4), which must use that cookie. Tests prove it: it is valid OpenAPI, the strict Redocly lint
(`redocly.yaml`) reports nothing, and every example matches its schema. `/api/docs` renders it with Scalar, bundled in
the app: no CDN, remote fonts, telemetry or AI services.

`GET /api/health` answers `200` with the app version when the database answers, `503` otherwise; the Docker
healthcheck calls it. The database error goes to the logs, never to the response.

## Interface

- Components follow atomic design: atoms, molecules, organisms, templates; Nuxt pages are the pages level. Each
  component has stories, run as tests in Chromium in every theme, contrast mode and locale. Storybook uses the plain
  Vue + Vite framework with small Nuxt shims, because the Nuxt Storybook framework does not support Nuxt 4.6 yet.
- Design tokens live in `app/assets/css/tokens.css`: the nebula and midnight palettes and the semantic Nuxt UI tokens
  for the midnight (default), light and strict themes. `shared/design/contrast.ts` defines the contrast requirements,
  checked by tests.
- Every string is in English and French (`@nuxtjs/i18n`, no locale in URLs).
- Icons are Lucide (`i-lucide-…`), bundled with the app (`@iconify-json/lucide`): the Iconify API is never called, so
  the app works offline and tells no third party where it runs.
- Accessibility targets RGAA 4.1 / WCAG 2.1 AA; the strict mode raises contrast to AAA, removes motion, keeps focus
  visible and enlarges targets. Every graph has an accessible table equivalent.

## Testing

Tests are the specification: acceptance criteria are written as test names before the code. Layers: unit tests
(Vitest), integration tests against SQLite and Postgres, stories as component tests, Docker image smoke tests, and
end-to-end tests with Playwright and axe _(planned)_. Coverage thresholds and nightly mutation testing guard the domain
logic. Test data comes from factories (the core's in `extensions/core/testing`, for its tests and those of the
extensions built on it) and the demo stack, with fictional values only (documentation and private IP ranges,
`.example` names), which tests check. On Postgres, each test gets its own schema, in a database of its Vitest worker.
See [CONTRIBUTING.md](../CONTRIBUTING.md).

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
