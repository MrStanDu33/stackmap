# Decisions

One entry per major decision, newest first: what was decided, why, and what was rejected. Details live in
[ARCHITECTURE.md](ARCHITECTURE.md) and [PRODUCT.md](PRODUCT.md); this log says why in one place. Add an entry in the
same pull request as the decision. Entries marked _retroactive_ record choices made before this log existed, dated by
the pull request that made them.

## 2026-11-24: Trunk-based development with tagged releases

**Decision:** pull requests go into `main`; releases are tags, `vX.Y.Z` for stable and `vX.Y.Z-rc.N` for
pre-releases, and every push to `main` publishes an `edge` image. A demo is a deployment of a channel, not a tag.
**Why:** one history, no protection bypass, channels that map to Docker tags; what Vue and Nuxt do.
**Rejected:** `develop` + `main` with a merge commit (works, but two histories), a fast-forward push to `main` (needs
a ruleset bypass), a `.demo` tag (not SemVer).
**Status:** planned; until it lands, `develop` + `main` apply as described in [CONTRIBUTING.md](../CONTRIBUTING.md).

## 2026-11-24: Approved specs become GitHub issues

**Decision:** an agent drafts the spec in `.ai/specs/` (gitignored); once approved, it is posted as a maintainer
"Spec" issue and pull requests say `Closes #n` or `Part of #n`. Features get a full spec, fixes a short one, chores
none. The tests remain the lasting specification.
**Why:** a durable, tool-neutral record linked to the pull requests, without reviewing drafts in public.
**Rejected:** specs committed in `docs/specs/` (go stale once the tests exist), specs only in issues (every review
round becomes public edits), the public feature-request form (too heavy for outside users).

## 2026-11-24: Agents propose commits; humans commit

**Decision:** an agent stages one commit and proposes its message; it commits only when the human asks. Pull
requests stay small (one shippable part of a feature, about 400 changed lines at most outside tests, locales and
generated files); the agent proposes a split beyond that.
**Why:** every commit is reviewed and signed by a person; small pull requests are reviewed properly.
**Rejected:** agents committing freely, a hard size limit in CI (blunt for contracts and migrations).

## 2026-11-24: Accessibility target is RGAA 4.1 plus WCAG 2.2 AA

**Decision:** RGAA 4.1 stays the reference, plus the criteria WCAG 2.2 AA added; RGAA 5 replaces both once published.
**Why:** RGAA is the French reference buyers ask for; WCAG 2.2 covers the edit mode's dragging and the sign-in.
**Rejected:** WCAG 2.1 AA only, WCAG 2.2 without RGAA.

## 2026-11-24: Security and privacy as a principle, encryption decided later

**Decision:** design as if the database could leak (store the minimum, no secrets of the documented infrastructure,
encrypted connector credentials, redaction); a threat model in ARCHITECTURE.md decides encryption at rest before the
team-ready milestone.
**Why:** the data is an attack-surface map; field encryption would break partial-match search, so its cost needs a
reason first.
**Rejected:** field-level encryption now, no written principle.

## 2026-11-24: Infrastructure teams are the primary users; v1 targets hobbyists

**Decision:** the primary users are infrastructure and DevOps teams in medium-sized companies; v1 ships for
self-hosting hobbyists, and a team-ready milestone follows it: single sign-on, history and audit, scoped API tokens
with an idempotent apply operation, import through connector extensions.
**Why:** v1's order is coherent and underway; teams need those features before trusting a source of truth.
**Rejected:** keeping teams out of the roadmap, reordering v1 around team features (later first release).

## 2026-11-24: Pipelines write through core tokens; tools map through extensions

**Decision:** API tokens and the apply operation belong to the core; one extension per tool maps its output
(Terraform state, compose files, Ansible inventories) to entities; the tools that run in a pipeline live outside the
app. If extensions ever add routes, an admin can turn that API off.
**Why:** tokens are authentication and a shared need; mapping is tool-specific.
**Rejected:** extensions providing their own write APIs now (third-party code reachable from the network).

## 2026-11-24: No error tracking service, no hosted environment

**Decision:** logs only; no hosted demo or staging before the license is chosen; a future cloud offer is hosted in
the EU.
**Why:** no telemetry is a product promise, and a public instance before the license invites use nobody may make.
**Rejected:** opt-in reporting to an admin's endpoint (possible later as an extension).

## 2026-11-24: Claude Code is the only supported agent tool

**Decision:** `AGENTS.md` stays tool-neutral and `CLAUDE.md` imports it; no other tool's files. Adding a tool means
adding its rule files in the same pull request and listing it in `docs/TOOLING.md`.
**Why:** files for tools nobody runs go stale.
**Rejected:** keeping the GitHub Copilot pointer.

## 2026-11-01: Workspace memberships in our own table (retroactive)

**Decision:** members and roles live in our `member` table, not Better Auth's organization plugin.
**Why:** the plugin would write the `workspace` table with its own column types; ours go through our repositories,
the same way on both databases (#28).

## 2026-11-01: Better Auth through its server API only (retroactive)

**Decision:** accounts use Better Auth, called from our contract routes; its router is not mounted.
**Why:** every account operation is then in the API document, with our validation and Problem Details (#27).

## 2026-10-24: The core is an extension (retroactive)

**Decision:** the core entities live in `extensions/core`, built with the same SDK as every extension.
**Why:** it proves the SDK is sufficient, and kinds and entity types come from manifests, never database enums (#14).

## 2026-10-12: Icons bundled, no third-party calls (retroactive)

**Decision:** Lucide icons are bundled; the Iconify API is never called.
**Why:** the app works offline and tells no third party where it runs (#8).

## 2026-10-11: Contracts first, Problem Details errors (retroactive)

**Decision:** every route implements a Zod contract; the OpenAPI document is generated from them; errors are RFC 9457
Problem Details.
**Why:** the API document can never drift from the code, and responses never leak undeclared fields (#7, #11).

## 2026-10-11: SQLite and Postgres through one code path (retroactive)

**Decision:** Kysely with the same storage types on both databases; SQLite by default.
**Why:** one container that runs anywhere, with Postgres for those who want it, without two code paths (#6).
**Rejected:** dialect-specific SQL.

## 2026-10-11: One Nuxt application, one container (retroactive)

**Decision:** a single Nuxt 4 full-stack app with Nuxt UI, shipped as one Docker image, with no telemetry.
**Why:** self-hosting must be one `docker compose up` (#1).
