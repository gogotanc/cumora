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

## Automated package safeguards

- PostgreSQL and runtime secrets are derived with deployment-time
  `stable_secret`; a published LPK does not share one embedded credential.
- Lazycat SSO is required for browser access. The full `/api` tree is not in
  `public_path`.
- Managed Kubernetes agents and their maintenance jobs are disabled.
- Persistent data lives under `/lzcapp/var/{postgres,redis,uploads}`.
- PostgreSQL, Redis and Cumora have health checks.
- PostgreSQL 17 with pgvector is pinned by OCI digest and fully embedded in
  the LPK, so semantic memory does not degrade or require a runtime pull.
- Pairing and reconnect commands use the public HTTPS origin so an external
  BYOA daemon can reach the app through `public_path`; the internal `.lzcapp`
  endpoint is only used when the daemon runs on the same LightOS box.
- The official Lazycat file chooser bridge covers browser file inputs.

## Verified candidate

- Candidate: `0.1.2` (`cloud.lazycat.app.cumora-v0.1.2.lpk`).
- A clean `0.1.0` installation was upgraded through `0.1.1` to `0.1.2`.
- PostgreSQL, Redis, uploads, users, companies and conversations survived the
  upgrades; the `0.1.2` database exposes pgvector `0.8.6` and the semantic
  memory embedding column.
- Cumora, PostgreSQL, Redis and the Lazycat gateway are healthy after upgrade;
  `/api/health` and `/api/livez` return HTTP 200 internally.
- Runtime HTML contains the official Lazycat file chooser injection, and the
  scheduler reports `runtime=byoa-only`.

## Manual submission evidence still required

- Reserve the final package ID in the developer center before publishing.
- Supply store screenshots and a Chinese usage guide showing LightOS pairing.
- Preserve the `0.1.0` clean-install package as the upgrade baseline; the
  current release candidate is `0.1.2`.
- Record supported microserver CPU architecture from the final LPK/image
  build. The current POC was verified on x86_64 only.
- Confirm the store reviewer accepts the upstream English application UI. The
  package metadata and usage are localized, but Cumora itself does not yet
  provide a full Chinese translation.
- Keep the previous LPK and a PostgreSQL backup for rollback; schema migrations
  are not automatically reversible.
