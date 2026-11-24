# Roadmap

## 🔴 Priority 0: choose a license

This blocks the first release and the first external contribution. Until then, all rights are reserved, and
contributions are accepted under the [CLA](CLA.md) so the project can be licensed later.

Options to compare:

- AGPL-3.0 for the core, with a commercial `ee/` directory;
- fair-code (Functional Source License, becoming Apache-2.0 after two years);
- MIT for the core, with a private repository for the cloud offer.

Also decide which features are paid. Keeping OIDC/SSO free avoids the "SSO tax" that self-hosters dislike.

The long-term model: free self-hosting, self-hosting with paid support, a free cloud tier, and a paid cloud tier with
more features and support.

## v1

v1 targets self-hosting hobbyists; the team-ready milestone after it serves infrastructure teams (see
[the product](PRODUCT.md)). Each feature starts with its acceptance criteria as test names, reviewed before
implementation, and ships as small pull requests, one part of the feature each.

Build order from here: phase 6, then the rest of phase 5 (installing, updating and removing extensions, one slice
each; then the remaining built-in extensions), then phases 7 to 9.

- [x] **1. Scaffold**: tooling, conventions, CI, design tokens, Storybook, agent configuration, Docker, docs.
- [x] **2. Foundations**: database layer (SQLite and Postgres), API contracts and OpenAPI, extension SDK and registry,
      extension hooks, failure isolation, locale packs and diagnostics.
- [x] **3. Vertical slice**: workspace-scoped repositories and test factories; hosts, networks, services, listeners,
      domains, DNS records and proxy routes → derived flows → hop-by-hop trace on a read-only graph, with the demo
      stack.
- [x] **4. Accounts and workspaces**: first-run setup, login, roles, invitations, user settings, password reset CLI.
- [ ] **5. Extensions and inventory**: installing, updating, toggling (per workspace) and removing extensions, with a
      warning for extensions that run code; onboarding ("What's in your stack?"), the built-in extensions, CRUD tables,
      search and the command palette.
- [ ] **6. Complete graph**: infrastructure and exposure views, filters, saved layouts, in-graph search.
- [ ] **7. Edit mode and custom types**: drag-and-drop editing and user-defined entity types.
- [ ] **8. Plans, templates and the wizard** (form view).
- [ ] **9. Polish**: accessibility audit, French review, demo workspace.

Built-in extensions in v1: reverse proxy, TLS certificates, VPN, router/NAT, containers, SSO/auth providers, template
packs (Nginx Proxy Manager, Traefik, Caddy), locale packs. Template packs need phase 8's plans. The light theme is
part of the core, next to midnight and strict; themes from extensions come with custom extensions (Later).

## Team-ready

What infrastructure teams need before they trust Stackmap as their source of truth. Before it starts, decide
encryption at rest from the threat model in [ARCHITECTURE.md](ARCHITECTURE.md#security-and-privacy), and the license
and business model (priority 0), since they decide what is paid.

- **Single sign-on**: OIDC.
- **History and audit**: entity history, diffs, who changed what.
- **API tokens and apply**: scoped tokens, and an idempotent apply operation for CI jobs and infrastructure-as-code
  tools; tool mappers as extensions, pipeline tools outside the app.
- **Import**: the first discovery connectors as extensions, through a review inbox.

## v1.1

- Wizard canvas view, synchronized both ways with the form.
- Graph plan mode: plan changes directly on the graph, with the plan's steps in a side panel.
- Built-in extensions: load balancing, virtualization (hypervisor nesting), tunnels (Cloudflare Tunnel, Tailscale
  Funnel) and backups.

## Later

- **Discovery connectors** (the first ones in Team-ready): import from Cloudflare, OVH, Gandi, Porkbun, Pi-hole,
  AdGuard, Nginx Proxy Manager, Traefik, Caddy, Portainer, Proxmox, docker-compose files and nmap scans, through a
  review inbox. Read-only access, credentials encrypted at rest.
- **Status**: built-in checks (HTTP, TCP, ping, DNS, certificate expiry) or status read from Uptime Kuma, Gatus,
  Healthchecks.io and Prometheus, shown on the graph and in traces.
- **Insights**: port conflicts, public apps without authentication, dangling DNS records, expiring certificates,
  services without backups, attack surface.
- **Authentication**: TOTP, passkeys, forward-auth header login (OIDC in Team-ready).
- **Public API**: webhooks, an Insomnia collection tested in CI (scoped tokens in Team-ready).
- **Import and export**: workspace JSON/YAML, git sync, database backup; graph export to PNG, SVG, Mermaid and draw.io.
- **Privacy**: redaction mode for screenshots, and a warning when Stackmap itself is reachable from the internet.
- **History**: undo (history and diffs in Team-ready).
- **Custom extensions**: builders for templates, wizard questions and themes, manifest import/export, a community
  gallery.
- **External extensions**: third-party extensions as sidecar containers or build-time layers, after a security review;
  no third-party code runs inside the app process or the browser.
- **Notifications**: ntfy, Gotify, email.
- **Live discovery**: read-only Docker agent and drift detection.
- **User documentation site**.
- **Cloud and commercial**: billing, license keys, SMTP, quotas, GDPR tooling, terms and privacy policy, status page;
  hosted in the EU.
