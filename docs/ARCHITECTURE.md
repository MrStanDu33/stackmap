# Architecture

This is the target architecture. Parts that are not built yet are marked _(planned)_; the
[roadmap](ROADMAP.md) says when they arrive, and the [decision records](adr/) explain the main choices.

## Overview

Stackmap is one Nuxt 4 application, shipped as one container:

- the **app** (`app/`): Vue 3 pages and components, Nuxt UI, Vue Flow for graphs, Pinia for editor state;
- the **server** (`server/`) _(planned)_: Nitro API routes, the domain logic and the database layer;
- **shared code** (`shared/`): code used by both, such as the API contracts and the design rules;
- **built-in extensions** (`extensions/<id>/`) _(planned)_: Nuxt layers that add entity types and features;
- the **extension SDK** (`packages/extension-sdk/`) _(planned)_.

Data lives in SQLite by default or in Postgres, through Kysely ([ADR 3](adr/0003-kysely-with-sqlite-by-default.md)).

## Repository layout

| Path                 | Contents                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| `app/`               | Pages, components (atomic design), CSS tokens, app config                  |
| `server/`            | API routes, domain logic, repositories, migrations _(planned)_             |
| `shared/`            | Code shared by the app and the server: contracts, design rules             |
| `extensions/`        | Built-in extensions _(planned)_                                            |
| `packages/`          | Extension SDK _(planned)_                                                  |
| `i18n/locales/`      | English and French messages                                                |
| `tests/`             | Unit tests that are not next to their code, fixtures, end-to-end tests     |
| `scripts/`           | Convention rules, release tooling and CI checks                            |
| `.storybook/`        | Storybook configuration and foundation pages                               |
| `docs/`              | Roadmap, architecture, decision records, CLA                               |

## Domain model _(planned)_

Every entity belongs to a **workspace** and has a status (`planned`, `active` or `deprecated`), tags, markdown notes,
links, custom fields, an origin (`manual` or a connector) and audit fields.

- A **site** contains **hosts** (physical, VM, LXC, VPS, network device). Hosts have IP addresses on **networks**.
- A **service** (app, database, cache, DNS, external API…) runs on a host and exposes **listeners** (port, protocol,
  bind address, published port).
- A **domain** has **DNS records**. Extensions add **proxy routes**, **certificates**, **VPNs**, **NAT rules** and
  **access policies** (ordered authentication chains).
- A **flow** is an edge from a service to a listener: protocol, purpose, encryption, access policy. Flows are
  **derived** from DNS records, proxy routes, NAT rules and so on, or added by hand.
- A **trace** is computed for a hostname: client → DNS → public IP, NAT or tunnel → proxy → upstream → dependencies.
- A **plan** is an ordered checklist. A step can link to an entity and turn it from `planned` to `active`. A
  **template** is a reusable plan with an entity blueprint.
- **Custom types** let users define entity types (fields, icon, graph role, relations, trace participation) stored in
  a generic table.

Kinds (host kinds, service kinds, protocols…) are text values validated against the extension registry, so an
extension can add one without a migration. Fields that an extension adds to a core entity live in the extension's own
table.

## Workspaces and isolation _(planned)_

Workspaces, members, roles (`owner`, `admin`, `editor`, `viewer`) and invitations come from Better Auth's organization
plugin ([ADR 6](adr/0006-better-auth-organizations-as-workspaces.md)). All data access goes through repositories scoped
to a workspace; tests prove that one workspace cannot read or change another's data. An entitlements service,
`can(workspace, feature)`, allows everything in v1 and prepares paid plans.

## Extensions _(planned)_

The core and the built-in extensions use the same SDK ([ADR 5](adr/0005-extensions-from-day-one.md)). An extension
contributes entity types, fields, kinds, flow types, **flow derivers** (turn its entities into flows), **trace hop
resolvers** (resolve the next hop through its entities), templates, wizard questions, themes, locales and, for
built-in extensions, code such as connectors and checks.

Workspace admins turn extensions on or off. Turning one off never deletes data:

1. if its entities carry live flows, the admin is warned first;
2. its types disappear from palettes, forms, search and filters;
3. its entities that are still connected show as greyed "hidden" boxes in graphs and traces, so paths stay continuous;
4. once a hidden entity has no connection left, the user chooses to delete it or keep it hidden.

## API _(planned)_

Every route is contract-first: its Zod input and output schemas, summary, errors and required role live in
`shared/contracts/`. The route handler imports its contract, and an OpenAPI 3.1 document is generated from the
contracts and served at `/api/docs`. CI fails when the document is stale.

## Interface

- Components follow atomic design: atoms, molecules, organisms, templates; Nuxt pages are the pages level. Each
  component has stories, run as tests in Chromium in every theme, contrast mode and locale
  ([ADR 1](adr/0001-storybook-with-the-vue-vite-framework.md)).
- Design tokens live in `app/assets/css/tokens.css`: the nebula and midnight palettes and the semantic Nuxt UI tokens
  for the midnight (default), light and strict themes. `shared/design/contrast.ts` defines the contrast requirements,
  checked by tests.
- Every string is in English and French (`@nuxtjs/i18n`, no locale in URLs).
- Accessibility targets RGAA 4.1 / WCAG 2.1 AA; the strict mode raises contrast to AAA, removes motion, keeps focus
  visible and enlarges targets. Every graph has an accessible table equivalent.

## Testing

Tests are the specification: acceptance criteria are written as test names before the code. Layers: unit tests
(Vitest), integration tests against SQLite and Postgres _(planned)_, stories as component tests, and end-to-end tests
with Playwright and axe _(planned)_. Coverage thresholds and nightly mutation testing guard the domain logic. See
[CONTRIBUTING.md](../CONTRIBUTING.md).

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
