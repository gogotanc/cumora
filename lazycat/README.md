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
