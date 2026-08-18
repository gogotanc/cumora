# Cumora BYOA for Lazycat

This package runs the Cumora web/API server with PostgreSQL and Redis inside
one Lazycat application. Managed Kubernetes agents are disabled; pair a
LightOS machine with Cumora's BYOA daemon instead.

## Build

```sh
chmod +x scripts/render-manifest.sh
./scripts/render-manifest.sh
lzc-cli project lint .
lzc-cli project release .
```

The renderer creates `.local/secrets.env` and `.local/lzc-manifest.yml` with
mode 0600. Both paths are ignored by Git.

## Runtime split

- Lazycat LPK: SPA, API, WebSocket, PostgreSQL, Redis, local uploads.
- LightOS: `npx cumora@latest agent computer` using local Codex or Claude.

Use the service-direct Lazycat address from LightOS when pairing so the BYOA
daemon does not need a public API bypass. Do not add the whole `/api` tree to
`public_path`.

For this package the internal server URL is:

```text
http://cumora.cloud.lazycat.app.cumora.lzcapp:5181
```

After pairing, install the daemon as a user service so it survives shell and
LightOS restarts:

```sh
npx cumora@latest agent computer --install-service \
  --server http://cumora.cloud.lazycat.app.cumora.lzcapp:5181
```

`LAZYCAT_AUTH_ENABLED` trusts `X-HC-User-ID` from Lazycat's authenticated app
ingress. Keep the auth exchange behind that ingress; this POC intentionally
does not expose an unauthenticated API route.
