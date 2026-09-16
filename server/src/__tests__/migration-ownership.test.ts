import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readRepo = (path: string): Promise<string> => readFile(resolve(repoRoot, path), 'utf8')

// The Lazycat fork permanently deletes `.github/workflows/deploy.yml` (see
// lazycat/UPSTREAM_SYNC.md), so the assertions that read it are conditional.
const DEPLOY_WORKFLOW = '.github/workflows/deploy.yml'
const hasDeployWorkflow = await readFile(resolve(repoRoot, DEPLOY_WORKFLOW), 'utf8').then(
  () => true,
  () => false,
)

test('application startup verifies schema compatibility and imports no migrator', async () => {
  const source = await readRepo('server/src/index.ts')
  assert.match(source, /verifySchemaWithBootRetry/)
  assert.doesNotMatch(source, /from ['"]\.\/db\/migrate\.js['"]/)
  assert.doesNotMatch(source, /ensureSchema/)
})

test('application Pod manifests contain no per-replica migration container', async () => {
  for (const path of [
    'server/k8s/cumora-server.gke.yaml',
    'server/k8s/cumora-server.orbstack.yaml',
  ]) {
    const manifest = await readRepo(path)
    assert.doesNotMatch(manifest, /^\s*- name: migrate\s*$/m, `${path} must not run DDL per replica`)
    assert.doesNotMatch(manifest, /command:\s*\["npm",\s*"run",\s*"migrate"\]/)
  }
})

test('production deploy delegates one guarded transaction to the recovery runner', {
  // Lazycat fork: the deploy workflow is permanently deleted (see
  // lazycat/UPSTREAM_SYNC.md), so its half of the deploy contract is not part
  // of this branch. Upstream's `main` still carries the workflow and this test.
  skip: !hasDeployWorkflow ? 'deploy.yml is not part of the Lazycat fork' : false,
}, async () => {
  const workflow = await readRepo(DEPLOY_WORKFLOW)
  assert.match(workflow, /scripts\/deploy-release\.mjs run/)
  assert.match(workflow, /CANDIDATE_SERVER_IMAGE/)
  assert.match(workflow, /MIGRATION_REPAIR/)
  assert.match(workflow, /RECOVERY_WORKDIR/)
  assert.match(workflow, /concurrency:/)
  assert.doesNotMatch(workflow, /kubectl rollout undo/)
})
