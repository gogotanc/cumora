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

## GitHub Actions

The upstream production, publishing, benchmark, and website workflows are
intentionally absent from `lazycat/main`. They target infrastructure and
credentials owned by the upstream project. The Lazycat branch retains only
the pull-request checks. Add a new workflow only when it targets infrastructure
owned by this fork and has been reviewed for its credential scope.
