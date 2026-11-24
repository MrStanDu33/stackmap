# Product

What Stackmap is for, who it serves and what it will not do. The [roadmap](ROADMAP.md) says when features arrive;
[decisions](DECISIONS.md) say why the product looks like this.

## Problem

Infrastructure teams can document their network equipment and their hardware with dedicated tools, but the software
layer (which domain reaches which app, through which proxy, on which port, behind which VPN or authentication) lives
in wiki pages, Notion documents, diagrams and people's memory. Those go stale, disagree with each other and cannot be
queried: nobody can say with confidence what is exposed or what a change will break.

Stackmap is the source of truth for that layer: entities with their relations, drawn as graphs, with a trace of any
hostname hop by hop.

## Users

- **Primary: infrastructure and DevOps teams in medium-sized companies** who need a shared, trustworthy description
  of what their infrastructure is made of and how it is configured.
- **Secondary: self-hosting and homelab hobbyists**, whose setups grow one container at a time.

The first version (v1) targets hobbyists, which validates the product with a smaller feature set. The team-ready
milestone right after v1 adds what teams need before they trust a source of truth: single sign-on, history and audit,
API tokens for pipelines, and import through connector extensions (see the [roadmap](ROADMAP.md)).

## Scope boundaries

The core documents the software layer. It is not:

- **a monitoring tool**: no alerting, no metrics history; it may show a current status next to what it documents,
  from simple built-in checks or from connector extensions to the tools that monitor (Uptime Kuma, Proxmox,
  Portainer…), so that information sits in one place;
- **a hardware inventory or CMDB**: hosts exist as places software runs; an optional extension may add hardware
  inventory;
- **a network-equipment configuration manager**: switch and router configurations stay in their tools; an optional
  extension may document them;
- **a secrets store**: it never stores credentials of the documented infrastructure, except connector credentials,
  encrypted at rest.

## Principles

- **Security and privacy first.** Stackmap holds a map of an organization's attack surface, so we assume its database
  can leak: store the minimum, never store secrets of the documented infrastructure, encrypt connector credentials at
  rest, isolate workspaces, redact exports and screenshots on request. The threat model is in
  [ARCHITECTURE.md](ARCHITECTURE.md#security-and-privacy).
- **Self-hosted first, one container.** `docker compose up`, SQLite by default, Postgres optional, works offline.
- **No telemetry.** Nothing phones home; the app calls no third-party service unless an admin configures one.
- **Extensible.** The core is an extension itself; features and entity types come from extensions users turn on or
  off.
- **Accessible.** RGAA 4.1 and WCAG 2.2 AA, with a strict mode; every graph has an accessible equivalent.
- **English and French**, complete; other languages through locale packs.
- **A future cloud offer is hosted in the EU** (GDPR).

## Tone

Professional, technical and neutral: plain sentences, the words an infrastructure engineer uses, no marketing, no
exclamation marks. Second person ("your machines"); in French, _vous_.

## Business model

> OPEN: license and business model are undecided (roadmap priority 0). Options under study: free self-hosting, paid
> support, a free cloud tier and a paid cloud tier. The 3-month success signal depends on it.
>
> ASSUMPTION (proposed success signal, not adopted): one real infrastructure team uses Stackmap as the source of truth
> for one environment. It can be observed without telemetry.
