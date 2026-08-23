/**
 * Integration test: the external-device (BYOA daemon) access surface added for
 * Cumora 0.1.4 — a dedicated daemon runtime-token endpoint that lets us keep
 * the public_path whitelist narrow (no wide `/api/agents/` prefix).
 *
 * Security-critical behaviours covered:
 *  - No device Bearer token → 401 for `/api/computers/me/agents` and
 *    `/api/computers/runtime-token`.
 *  - No agent JWT → 401 for `/runtime/wake-stream`.
 *  - `POST /api/computers/runtime-token` accepts the target agent in the body,
 *    requires `agentId`, returns 403 for an agent not assigned to the calling
 *    computer, and mints a runtime token only for an assigned agent.
 *  - Management endpoints (`/api/computers`, `/api/agents/:id/computer`) remain
 *    user-session-gated (401 without a session) — the public_path whitelist
 *    must NOT reach them at the app layer.
 *
 * The Ingress-level interception (Case 2 in the acceptance checklist) is a
 * manifest `public_path` concern and is verified separately against the live
 * Dev domain.
 *
 * Requires a real Postgres + Redis (INTEGRATION_DATABASE_URL); see
 * server/run-integration-tests.mjs.
 */
import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { ensureSchemaOnce, resetAllTables, teardownAll } from './_helpers.js'
import { pool } from '../db/pool.js'

let server: Server
let baseUrl = ''

before(async () => {
  await ensureSchemaOnce()
  // Mount the real /api router (with its real authMiddleware) and the real
  // /runtime router. No fake user stamp — device routes read the Bearer header
  // themselves and management routes should 401 without a real session.
  const expressMod = await import('express')
  const express = expressMod.default
  const { api } = await import('../api/router.js')
  const { runtimeRouter } = await import('../agents/runtime/server.js')
  const app = express()
  app.use(express.json({ limit: '34mb' }))
  app.use('/api', api)
  app.use('/runtime', runtimeRouter)
  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`
      resolve()
    })
  })
})

beforeEach(async () => {
  await resetAllTables()
})

after(async () => {
  await teardownAll(server)
})

async function call(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) }
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const text = await res.text()
  let parsed: any = null
  try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }
  return { status: res.status, body: parsed }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

/** Seed a company, a paired local computer (with a redeemable device token),
 *  and an agent assigned to that computer. Returns the ids + device token. */
async function seedPairedComputer(agentOnComputer = true): Promise<{
  companyId: string; computerId: string; agentId: string; deviceToken: string
}> {
  const companyId = `c-${randomUUID().slice(0, 8)}`
  const computerId = `comp-${randomUUID().slice(0, 8)}`
  const agentId = `a-${randomUUID().slice(0, 8)}`
  const deviceToken = `dev-${randomUUID()}`
  await pool.query(
    `INSERT INTO companies (id, name, slug, owner_user_id) VALUES ($1, $2, $3, $4)`,
    [companyId, `Co ${companyId}`, companyId, 'test-owner'],
  )
  await pool.query(
    `INSERT INTO computers (id, company_id, name, kind, available_engines, status, credential_hash)
     VALUES ($1, $2, $3, 'local', '["claude"]', 'online', $4)`,
    [computerId, companyId, 'Test Computer', hashToken(deviceToken)],
  )
  if (agentOnComputer) {
    await pool.query(
      `INSERT INTO participants (id, company_id, kind, name, role, initial, avatar_bg, status, computer_id, engine)
       VALUES ($1, $2, 'agent', $3, 'tester', $4, '#abcdef', 'avail', $5, 'claude')`,
      [agentId, companyId, `Agent ${agentId}`, agentId.slice(0, 1).toUpperCase(), computerId],
    )
  }
  return { companyId, computerId, agentId, deviceToken }
}

// ── Case 1: unauthenticated daemon routes → 401 ─────────────────────────

test('[integration] external-access: no device token → 401 on me/agents', async () => {
  const r = await call('/api/computers/me/agents', { method: 'GET' })
  assert.equal(r.status, 401)
})

test('[integration] external-access: no device token → 401 on runtime-token', async () => {
  const r = await call('/api/computers/runtime-token', { body: { agentId: 'a-x' } })
  assert.equal(r.status, 401)
})

test('[integration] external-access: no agent JWT → 401 on wake-stream', async () => {
  const r = await call('/runtime/wake-stream', { method: 'GET' })
  assert.equal(r.status, 401)
})

// ── Case 2: management endpoints stay session-gated ────────────────────

test('[integration] external-access: /api/computers stays user-session-gated (401 without session)', async () => {
  const r = await call('/api/computers', { method: 'GET' })
  assert.equal(r.status, 401)
})

test('[integration] external-access: /api/agents/:id/computer stays user-session-gated (401 without session)', async () => {
  const r = await call('/api/agents/a-whatever/computer', { body: { computerId: 'comp-x' } })
  assert.equal(r.status, 401)
})

// ── runtime-token endpoint contract ────────────────────────────────────

test('[integration] external-access: runtime-token 400 when agentId missing', async () => {
  const { deviceToken } = await seedPairedComputer()
  const r = await call('/api/computers/runtime-token', { token: deviceToken, body: {} })
  assert.equal(r.status, 400)
  assert.match(String(r.body?.error ?? ''), /agentId/i)
})

test('[integration] external-access: runtime-token 403 for an agent not assigned to this computer', async () => {
  const { deviceToken } = await seedPairedComputer(true)
  const r = await call('/api/computers/runtime-token', { token: deviceToken, body: { agentId: 'a-not-assigned' } })
  assert.equal(r.status, 403)
  assert.match(String(r.body?.error ?? ''), /not assigned/i)
})

test('[integration] external-access: runtime-token mints a token for an assigned agent', async () => {
  const { deviceToken, agentId } = await seedPairedComputer(true)
  const r = await call('/api/computers/runtime-token', { token: deviceToken, body: { agentId } })
  assert.equal(r.status, 200)
  assert.ok(typeof r.body?.token === 'string' && r.body.token.length > 0, 'token returned')
  assert.ok(r.body?.expiresInSeconds > 0, 'expiresInSeconds returned')
})

test('[integration] external-access: me/agents lists the computer agents', async () => {
  const { deviceToken, agentId } = await seedPairedComputer(true)
  const r = await call('/api/computers/me/agents', { method: 'GET', token: deviceToken })
  assert.equal(r.status, 200)
  assert.ok(Array.isArray(r.body), 'agents list returned')
  assert.ok(r.body.some((a: { id: string }) => a.id === agentId), 'assigned agent present')
})
