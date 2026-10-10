# Security policy

Stackmap stores maps of infrastructure: hosts, IP addresses, domains, open ports, access policies and, later,
connector credentials. A vulnerability can expose much more than the app itself, so please report it privately.

## Reporting a vulnerability

Use GitHub's private reporting: **[Report a vulnerability](https://github.com/MrStanDu33/stackmap/security/advisories/new)**.

Do not open a public issue, discussion or pull request for a vulnerability.

Please include:

- the affected version or commit;
- the steps to reproduce, or a proof of concept;
- the impact you expect (for example, reading another workspace's data).

Do not include real infrastructure data from your own setup or anyone else's.

## What to expect

Stackmap is maintained by one person, so these are targets, not guarantees:

- an acknowledgement within 7 days;
- an assessment and a fix plan within 30 days for confirmed issues;
- a security advisory and a fixed release, crediting you unless you prefer otherwise.

## Supported versions

Stackmap has not had a release yet. Once it has, only the latest release receives security fixes.

## Scope

In scope: the Stackmap application and its official Docker image, including authentication, authorization and
workspace isolation, data exposure, and injection.

Out of scope: vulnerabilities in your reverse proxy, network or host configuration, and reports from automated
scanners without a demonstrated impact.
