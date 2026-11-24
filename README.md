# Stackmap

[![CI](https://github.com/MrStanDu33/stackmap/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/MrStanDu33/stackmap/actions/workflows/ci.yml)
[![Storybook](https://img.shields.io/badge/storybook-components-ff4785)](https://mrstandu33.github.io/stackmap/)

**Self-hosted documentation for your infrastructure.** Servers, apps, DNS, ports, reverse proxies, VPNs and auth layers,
shown as interactive graphs. Trace a request hop by hop: DNS → edge → reverse proxy → app → database and APIs.

> **Status: early development, not released yet.** Accounts, workspaces, the inventory, the traffic graph and traces
> work; extensions, the complete graph, edit mode and plans are in progress. Follow the [roadmap](docs/ROADMAP.md).

## Why

Network equipment and hardware have their inventory tools, but the software layer lives in wiki pages and people's
memory: which domain reaches which app, through which proxy, on which port, behind which VPN or SSO. It goes stale.
Stackmap is the source of truth for that layer, for infrastructure teams and for self-hosted setups that grow one
container at a time, and it draws it. See [the product](docs/PRODUCT.md).

## Planned features (v1)

- **Graphs**: infrastructure, traffic and exposure views, with filters and an animated trace of any hostname.
- **Inventory**: tables and forms for hosts, networks, services, listeners, domains, DNS records, proxy routes,
  certificates, VPNs and NAT rules.
- **Plans**: a wizard and templates ("app behind Nginx Proxy Manager with SSO") that turn a deployment into a
  checklist, with planned items shown dashed on the graph until they are done.
- **Extensions**: turn features on or off to match your stack, and define your own entity types.
- **Workspaces** with roles, English and French, and an RGAA-compliant interface with a strict high-contrast mode.
- **One container**: `docker compose up`, SQLite by default, Postgres optional. No telemetry.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the setup, the commands and how we work (tests first, gitmoji commits).
Components are documented in [Storybook](https://mrstandu33.github.io/stackmap/), and the design in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Security

Stackmap stores maps of infrastructure. Report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md).

## License

No license has been chosen yet, so all rights are reserved for now (see [LICENSE](LICENSE)). Choosing one is the top
item of the [roadmap](docs/ROADMAP.md). Contributions are accepted under the [CLA](docs/CLA.md), which allows the
project to be licensed later.
