# Cumora for Lazycat

This package runs the Cumora web/API server with PostgreSQL 17 + pgvector and
Redis inside one Lazycat application. Managed Kubernetes agents are disabled;
pair a LightOS machine with Cumora's BYOA daemon instead.

## Build

```sh
lzc-cli project lint .
lzc-cli project release .
```

The manifest uses Lazycat's deployment-time `stable_secret` function. Each
installation receives distinct, stable PostgreSQL and agent-runtime secrets;
no publisher or developer credentials are embedded in the LPK.

The PostgreSQL image is pinned by digest and embedded as `cumora-postgres`.
This keeps semantic memory available without pulling an image during install.

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
ingress. Keep the auth exchange behind that ingress; this package intentionally
does not expose an unauthenticated API route. The pairing UI prints the private
service URL because a BYOA daemon cannot pass through the browser SSO ingress.

The browser injects Lazycat's official file chooser bridge so Cumora's upload
inputs can select files from either the local device or Lazycat storage. See
`content/lazycat-injects/README.md` for its pinned source and checksum.
