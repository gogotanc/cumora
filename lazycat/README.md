# Cumora for Lazycat

This package runs the Cumora web/API server with PostgreSQL 17 + pgvector and
Redis inside one Lazycat application. Managed Kubernetes agents are disabled;
pair a LightOS machine with Cumora's BYOA daemon instead.

## Build

```sh
lzc-cli project lint .
lzc-cli project release .
```

## Migrations

The server never runs DDL at boot — since upstream v0.14.0 it only runs a
read-only `schema_migrations` gate and exits when the ledger is missing
(`MigrationHistoryError: schema_uninitialized`). Upstream supplies the DDL with
a pre-deploy Kubernetes Job; Lazycat has no equivalent primitive, so this
package runs `npm run migrate` as the first half of the container `CMD` (see
`server/docker/cumora-server.Dockerfile` and its `.dev` variant) and only then
starts the server; a bounded retry absorbs Lazycat's parallel postgres/redis
start. Never remove that step: a fresh install would crashloop on an empty
database.

The migrator adopts an existing database through the frozen
`0001_legacy_baseline` (all statements idempotent) and then applies the
versioned suffix, so both a green-field install and an instance upgrading from
an older LPK converge on the same schema. Reruns read the ledger and exit in
~20ms (measured 28ms).

Verified on LightOS (2026-09-17): a green-field install applies versions 1-9 in
11.1s and the app is healthy 22s after start; migrating a copy of a live 0.1.5
database (60 tables, 31 conversations, 35 838 messages, no ledger) yields 65
tables, 9 ledger rows and 86 normalized conversation members with every row
intact. Keep the chain in the image `CMD`, not in the manifest: Lazycat's
`command` field accepts a *string* only, and `lzc-cli project lint` does not
catch a list.

The manifest uses Lazycat's deployment-time `stable_secret` function. Each
installation receives distinct, stable PostgreSQL and agent-runtime secrets;
no publisher or developer credentials are embedded in the LPK.

The PostgreSQL image is pinned by digest and embedded as `cumora-postgres`.
This keeps semantic memory available without pulling an image during install.

## Runtime split

- Lazycat LPK: SPA, API, WebSocket, PostgreSQL, Redis, local uploads.
- LightOS: `npx cumora@latest agent computer` using local Codex or Claude.

The pairing/reconnect command the UI prints uses the app's **public HTTPS
domain** (the `CUMORA_PUBLIC_ORIGIN` injected into the served HTML, i.e.
`https://${LAZYCAT_APP_DOMAIN}`). That is the only origin a BYOA daemon running
on a device logged into the Lazycat client can reach — it goes through the
Ingress and the `public_path` whitelist, so it does not expose the whole `/api`
tree. The internal `.lzcapp` address is app-to-app only and never resolves
outside the microserver's container network.

Only when the daemon runs **on the same LightOS box** can you optionally use
the app's internal service address (bypassing the public gateway):

```text
http://cumora.cloud.lazycat.app.cumora.lzcapp:5181
```

After pairing, install the daemon as a user service so it survives shell and
LightOS restarts:

```sh
npx cumora@latest agent computer --install-service \
  --server https://cumora.hitanc.heiyu.space
```

`LAZYCAT_AUTH_ENABLED` trusts `X-HC-User-ID` from Lazycat's authenticated app
ingress. Keep the auth exchange behind that ingress; this package intentionally
does not expose an unauthenticated API route. The pairing UI prints the public
HTTPS origin; the daemon authenticates with its device-token / runtime-token
through the `public_path` whitelist, so it never needs the browser SSO session.

The browser injects Lazycat's official file chooser bridge so Cumora's upload
inputs can select files from either the local device or Lazycat storage. See
`content/lazycat-injects/README.md` for its pinned source and checksum.
