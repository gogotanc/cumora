# Store readiness

## Distribution contract

- Package ID: `cloud.lazycat.app.cumora`
- Display name: `Cumora`
- Browser domain: assigned from `${LAZYCAT_APP_DOMAIN}` at deployment
- BYOA service: the app's public HTTPS origin (`https://${LAZYCAT_APP_DOMAIN}`),
  reachable from a device logged into the Lazycat client via the `public_path`
  whitelist. The internal `.lzcapp` address is app-to-app only and never
  resolves on an external device.
- Runtime: Cumora Web/API, PostgreSQL, Redis and local uploads in the LPK;
  Codex or Claude Code runs on a user-managed LightOS computer.

## Port scope (fork contract)

This package is a fork of `yetone/cumora`. The port is deliberately limited to
Lazycat integration so upstream releases can be re-based cheaply:

- Lazycat authentication: the ingress-authenticated user header is trusted and
  minted into a Cumora session (`LAZYCAT_AUTH_ENABLED`).
- Lazycat file drive: downloads are converted to blob URLs so the official file
  chooser bridge can take over, and the inject itself lives in the LPK.
- Public origin: the server injects the app's public HTTPS origin into the SPA
  so external daemons get a reachable pairing address.
- Packaging: manifest, Dockerfiles, build/dev overlays under `lazycat/`.

Upstream application logic, and every published `agent-cli` daemon, are left
untouched — users run the official daemon from npm, so patched daemon code
would never reach them and would break upstream compatibility.

## Automated package safeguards

- PostgreSQL and runtime secrets are derived with deployment-time
  `stable_secret`; a published LPK does not share one embedded credential.
- Lazycat SSO is required for browser access. The full `/api` tree is not in
  `public_path`.
- Managed Kubernetes agents and their maintenance jobs are disabled
  (`CUMORA_BYOA_ONLY=true`).
- Persistent data lives under `/lzcapp/var/{postgres,redis,uploads}`.
- PostgreSQL, Redis and Cumora have health checks.
- PostgreSQL 17 with pgvector is pinned by OCI digest and fully embedded in
  the LPK, so semantic memory does not degrade or require a runtime pull.
- Pairing and reconnect commands always use the public HTTPS origin so an
  external BYOA daemon can reach the app through `public_path`. The internal
  `.lzcapp` service address is never offered — it is app-to-app only.
- Schema verification treats DNS resolution failures (`EAI_AGAIN`,
  `ENOTFOUND`) as transient: on Lazycat the server, PostgreSQL and Redis start
  in parallel, so the database hostname can be unresolvable for the first
  seconds. Upstream only retries connection-shaped errors, which turns that
  race into a crashloop.
- The official Lazycat file chooser bridge covers browser file inputs.

## Verified candidate

- In progress: `0.1.6`, re-basing the port onto upstream `v0.18.4`.
- Released: `0.1.5` (`cloud.lazycat.app.cumora-v0.1.5.lpk`), the previous store
  version.
- Historical: a clean `0.1.0` installation was upgraded through `0.1.1` to
  `0.1.2`; PostgreSQL, Redis, uploads, users, companies and conversations
  survived the upgrades, and the database exposed pgvector `0.8.6` with the
  semantic-memory embedding column.
- Cumora, PostgreSQL, Redis and the Lazycat gateway are healthy after upgrade;
  `/api/health` and `/api/livez` return HTTP 200 internally.
- Runtime HTML contains the official Lazycat file chooser injection, and the
  scheduler reports `runtime=byoa-only`.

## Manual submission evidence still required

- Record supported microserver CPU architecture from the final LPK/image
  build. Verification so far is x86_64 only.
- Keep the previous LPK and a PostgreSQL backup for rollback; schema migrations
  are not automatically reversible.
- Refresh store screenshots for the `0.1.6` UI if the layout changed.

Chinese UI coverage is no longer a submission risk: the package ships upstream's
complete `zh-CN` locale (1772/1772 keys).
