# Upstream sync policy

This fork has two long-lived branches:

- `main` is an unmodified, fast-forward-only mirror of
  `yetone/cumora:main`.
- `lazycat/main` contains the supported Lazycat package and all
  Lazycat-specific changes.

Never push to `upstream`. All feature work starts from `lazycat/main` and
returns there through a reviewed pull request.

## Syncing upstream

Run this on a clean worktree. Fetch first, then fast-forward the mirror. Do
not use `reset --hard` or force-push to repair divergence.

```sh
git fetch upstream --prune
git switch main
git merge --ff-only upstream/main
git push origin main
git switch lazycat/main
git merge main
```

Resolve any conflict in favor of the current Lazycat security and packaging
contract, then run the normal TypeScript checks, build an LPK, and verify a
clean install plus upgrade before pushing the merge.

## Port scope

Keep the Lazycat delta as small as possible. The port exists to make upstream
work on Lazycat, not to improve it:

- Only Lazycat authentication, the Lazycat file drive, the public-origin handoff
  and packaging belong here. Prefer adapting an existing upstream extension
  point over adding a parallel code path — for example the public pairing origin
  is injected inside upstream's own `getPairingServerOrigin()`, so every
  upstream call site keeps working untouched.
- Never patch the daemon (`agent-cli/` and the server-side computer daemon
  protocol). Users install the published npm daemon, so changed daemon code
  never reaches them and only breaks upstream compatibility.
- Lazycat deployments have no Kubernetes. Managed agent Pods must stay disabled
  (`CUMORA_BYOA_ONLY=true`) — do not let upstream's Pod path become reachable.
- Reconfiguring an upstream file is acceptable when a check must stay: the gate
  workflows below are retargeted to `lazycat/main` rather than deleted.

## Release flow

1. Branch from `lazycat/main`: `feature/cumora-v<upstream-version>-dev`.
2. `git merge <upstream tag>`; resolve in favor of the port scope above.
3. Run `npm run typecheck`, `npm run server:typecheck`, `npm run lint`, the test
   suite, then `lzc-cli project lint .`.
4. Set `lazycat/package.yml` `version:` to the upstream release being ported —
   this fork tracks upstream version numbers (`package.json` has always tracked
   upstream on its own; the `0.1.x` tags predate that rule). Build, then deploy to
   the dev package for acceptance on the box:
   `lzc-cli project build -f lzc-build.dev.yml` (the dev config builds on the
   box), then `lzc-cli project deploy --dev` — `deploy` only installs a
   pre-built LPK and exits when `lazycat/dist` is missing.
5. After acceptance, tag `lzc-v<same upstream version>` and push that tag to
   Gitea **only**, then submit to the Lazycat app store. The `lzc-` prefix is
   required: upstream already owns the bare `v<version>` tag in this clone
   (tags come down with the upstream remotes), and `origin` is a fork of
   `yetone/cumora` that inherits upstream's tags, so a bare `v<version>`
   pushed there collides with the upstream release. Gitea is the single remote
   that carries this fork's release tags.

### Build mirrors

The Dockerfiles pin npm to `registry.npmmirror.com`, apt to
`mirrors.tuna.tsinghua.edu.cn` and the kubectl download to
`files.m.daocloud.io`. Upstream builds assume `registry.npmjs.org`,
`deb.debian.org` and `dl.k8s.io`, none of which are routable from the box or
from this workspace; without the pins a build only succeeds while the on-box
builder cache is warm, and fails later with `npm error Exit handler never
called!` followed by `npm run build` exiting 127.

## Migrations and schema ownership

Upstream v0.14.0 removed all DDL from the server boot path: a replica now runs
a read-only `schema_migrations` gate (`MigrationHistoryError:
schema_uninitialized`) and the DDL is applied by the pre-deploy Job in
`deploy.yml` — a workflow this fork deliberately deletes, and Lazycat has no Job
primitive at all. The port therefore keeps that responsibility in the image
`CMD`: migrate first, then `exec npm run server:start`, under a bounded retry (a
portainer-style one-shot job cannot be scheduled on LightOS).

Rules when touching the packaging layer:

- Keep the `CMD` chain in both `server/docker/cumora-server*.Dockerfile`. Leave
  the manifest upstream-shaped: its `command` field is a *string*, not a list,
  and `lzc-cli project lint` does not catch the mistake.
- Never rehearse the boot path by dropping `schema_migrations` from an
  already-migrated database. That state cannot occur in production, and the
  versioned migrations are not idempotent against it — 0002 issues a plain
  `CREATE TABLE conversation_members`, so the migrator fails forever on a
  database that is already at version 9.
- To rehearse a real upgrade, copy the live database into a scratch database and
  point the migrator at it from inside the running container:
  `pg_dump <live> | psql <scratch>`, then `DATABASE_URL=<scratch> npm run
  migrate`. Confirmed this way on 2026-09-17 against a live 0.1.5 database.

## GitHub Actions

The upstream production, publishing, benchmark, and website workflows are
intentionally absent from `lazycat/main`. They target infrastructure and
credentials owned by the upstream project. The Lazycat branch retains only the
quality gates: `build.yml`, `pr.yml` and `agent-fuse.yml`, all triggered on
`lazycat/main`. Add a new workflow only when it targets infrastructure owned by
this fork and has been reviewed for its credential scope; when upstream adds a
gate worth keeping, retarget its branch filter.
