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
4. Bump `lazycat/package.yml` and deploy to the dev package
   (`lzc-cli project deploy --dev`) for acceptance on the box.
5. After acceptance, tag `v<fork version>` (Gitea carries the release tags) and
   submit to the Lazycat app store.

## GitHub Actions

The upstream production, publishing, benchmark, and website workflows are
intentionally absent from `lazycat/main`. They target infrastructure and
credentials owned by the upstream project. The Lazycat branch retains only the
quality gates: `build.yml`, `pr.yml` and `agent-fuse.yml`, all triggered on
`lazycat/main`. Add a new workflow only when it targets infrastructure owned by
this fork and has been reviewed for its credential scope; when upstream adds a
gate worth keeping, retarget its branch filter.
