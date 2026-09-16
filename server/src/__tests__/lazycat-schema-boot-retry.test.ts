/** 懒猫部署回归：server / PostgreSQL / Redis 在盒上是并行启动的，PG 主机名
 *  尚未就绪时拿到的是 DNS 解析错误（EAI_AGAIN / ENOTFOUND）而不是连接错误。
 *  上游 schema-boot-retry.test.ts 只覆盖连接类瞬时故障，这里补上 DNS 两类 ——
 *  少了这条判据，容器会在启动竞态里快速失败并 crashloop。
 *
 *  Run: node --import tsx --test server/src/__tests__/lazycat-schema-boot-retry.test.ts */
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.CUMORA_RUNTIME_CLIENT = 'http'
process.env.OPENAI_API_KEY ??= 'test-key'

const { verifySchemaWithBootRetry } = await import('../db/schema-version.js')
const noSleep = async (_ms: number): Promise<void> => {}

test('retries EAI_AGAIN while the pg hostname is not resolvable yet', async () => {
  let calls = 0
  const version = await verifySchemaWithBootRetry({
    verifyFn: async () => {
      calls++
      if (calls < 3) {
        const err = new Error('getaddrinfo EAI_AGAIN cumora-postgres') as Error & { code: string }
        err.code = 'EAI_AGAIN'
        throw err
      }
      return 7
    },
    sleep: noSleep,
  })
  assert.equal(version, 7)
  assert.equal(calls, 3)
})

test('retries ENOTFOUND', async () => {
  let calls = 0
  await verifySchemaWithBootRetry({
    verifyFn: async () => {
      calls++
      if (calls < 2) {
        const err = new Error('getaddrinfo ENOTFOUND cumora-postgres') as Error & { code: string }
        err.code = 'ENOTFOUND'
        throw err
      }
      return 7
    },
    sleep: noSleep,
  })
  assert.equal(calls, 2)
})

test('retries on the DNS code alone when the message does not name it', async () => {
  let calls = 0
  await verifySchemaWithBootRetry({
    verifyFn: async () => {
      calls++
      if (calls < 2) {
        const err = new Error('connection error') as Error & { code: string }
        err.code = 'EAI_AGAIN'
        throw err
      }
      return 7
    },
    sleep: noSleep,
  })
  assert.equal(calls, 2)
})

test('still fails fast on schema-history errors', async () => {
  const { MigrationHistoryError } = await import('../db/migrations/manifest.js')
  let calls = 0
  await assert.rejects(
    () =>
      verifySchemaWithBootRetry({
        verifyFn: async () => {
          calls++
          throw new MigrationHistoryError('schema_behind', 'run migrations')
        },
        sleep: noSleep,
      }),
    /run migrations/,
  )
  assert.equal(calls, 1)
})
