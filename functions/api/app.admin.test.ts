import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppBindings } from './lib/types'

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createClerkClient: vi.fn(),
  drizzle: vi.fn(),
  selectResults: [] as unknown[][],
  updateResults: [] as unknown[][],
  inserts: [] as unknown[],
  updates: [] as unknown[],
}))

vi.mock('@clerk/backend', () => ({
  createClerkClient: mocks.createClerkClient,
}))

vi.mock('drizzle-orm/d1', () => ({
  drizzle: mocks.drizzle,
}))

import { app } from './app'

type SelectQuery = PromiseLike<unknown[]> & {
  from: () => SelectQuery
  where: () => SelectQuery
  orderBy: () => SelectQuery
  limit: () => Promise<unknown[]>
}

type UpdateQuery = PromiseLike<unknown[]> & {
  set: (value: unknown) => UpdateQuery
  where: () => UpdateQuery
  returning: () => Promise<unknown[]>
}

type InsertQuery = {
  values: (value: unknown) => Promise<unknown>
}

type ApiJson = {
  data?: unknown
  error?: {
    code?: string
  }
}

function selectQueryFor(rows: unknown[]): SelectQuery {
  const promise = Promise.resolve(rows)
  const query = {
    from: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => promise,
    then: promise.then.bind(promise),
  }
  return query
}

function updateQueryFor(rows: unknown[]): UpdateQuery {
  const promise = Promise.resolve(rows)
  const query = {
    set: (value: unknown) => {
      mocks.updates.push(value)
      return query
    },
    where: () => query,
    returning: () => promise,
    then: promise.then.bind(promise),
  }
  return query
}

function insertQuery(): InsertQuery {
  return {
    values: (value: unknown) => {
      mocks.inserts.push(value)
      return Promise.resolve(value)
    },
  }
}

function env(overrides: Partial<AppBindings> = {}): AppBindings {
  return {
    DB: {} as D1Database,
    ENVIRONMENT: 'preview',
    PUBLIC_APP_NAME: 'Workyard',
    PUBLIC_APP_URL: 'https://preview.contractor-marketplace.pages.dev',
    VITE_PUBLIC_APP_NAME: 'Workyard',
    VITE_PUBLIC_APP_URL: 'https://preview.contractor-marketplace.pages.dev',
    SERVICE_MARKET: 'United States',
    ALLOW_DEMO_AUTH: 'false',
    CLERK_SECRET_KEY: 'sk_test',
    CLERK_PUBLISHABLE_KEY: 'pk_test',
    CLERK_JWT_KEY: 'jwt-key',
    ...overrides,
  }
}

function userRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'admin_1',
    clerkUserId: 'clerk_admin_1',
    name: 'Morgan Chen',
    email: 'admin@example.com',
    platformRole: 'platform_admin',
    status: 'active',
    ...overrides,
  }
}

function mockAuthenticatedClerkUser(userId = 'clerk_admin_1') {
  mocks.authenticateRequest.mockResolvedValue({
    isAuthenticated: true,
    toAuth: () => ({ userId }),
  })
}

async function readJson(response: Response): Promise<ApiJson> {
  const body: unknown = await response.json()
  return body as ApiJson
}

describe('admin moderation routes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.clearAllMocks()
    mocks.selectResults = []
    mocks.updateResults = []
    mocks.inserts = []
    mocks.updates = []
    mocks.createClerkClient.mockReturnValue({
      authenticateRequest: mocks.authenticateRequest,
    })
    mocks.drizzle.mockReturnValue({
      select: vi.fn(() => selectQueryFor(mocks.selectResults.shift() ?? [])),
      update: vi.fn(() => updateQueryFor(mocks.updateResults.shift() ?? [])),
      insert: vi.fn(() => insertQuery()),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists pending companies for platform admins', async () => {
    const pendingCompany = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Pending Roofing',
      status: 'pending',
    }
    mockAuthenticatedClerkUser()
    mocks.selectResults = [[userRecord()], [pendingCompany]]

    const response = await app.request('/api/v1/admin/companies/pending', {}, env())
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toEqual([pendingCompany])
  })

  it('rejects company moderation for non-admin users', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [[userRecord({ platformRole: 'buyer' })]]

    const response = await app.request('/api/v1/admin/companies/pending', {}, env())
    const body = await readJson(response)

    expect(response.status).toBe(403)
    expect(body.error?.code).toBe('forbidden')
  })

  it('approves pending companies and writes an audit event', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [[userRecord()]]
    mocks.updateResults = [[{ id: '11111111-1111-4111-8111-111111111111' }]]

    const response = await app.request(
      '/api/v1/admin/companies/11111111-1111-4111-8111-111111111111/approve',
      { method: 'POST' },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'verified',
    })
    expect(mocks.updates[0]).toMatchObject({ status: 'verified' })
    expect(mocks.inserts[0]).toMatchObject({
      actorId: 'admin_1',
      action: 'company.approved',
      targetType: 'company',
      targetId: '11111111-1111-4111-8111-111111111111',
    })
  })

  it('rejects approval when a company is no longer pending', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [[userRecord()]]
    mocks.updateResults = [[]]

    const response = await app.request(
      '/api/v1/admin/companies/11111111-1111-4111-8111-111111111111/approve',
      { method: 'POST' },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(409)
    expect(body.error?.code).toBe('company_not_pending')
    expect(mocks.inserts).toHaveLength(0)
  })

  it('suspends companies with an audit reason', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [[userRecord()]]
    mocks.updateResults = [[]]

    const response = await app.request(
      '/api/v1/admin/companies/11111111-1111-4111-8111-111111111111/suspend',
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'License expired during launch review.' }),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'suspended',
    })
    expect(mocks.updates[0]).toMatchObject({ status: 'suspended' })
    expect(mocks.inserts[0]).toMatchObject({
      actorId: 'admin_1',
      action: 'company.suspended',
      targetType: 'company',
      targetId: '11111111-1111-4111-8111-111111111111',
    })
  })

  it('shows audit entries to platform admins', async () => {
    const auditEntry = {
      id: 'audit_1',
      action: 'company.approved',
      actorId: 'admin_1',
    }
    mockAuthenticatedClerkUser()
    mocks.selectResults = [[userRecord()], [auditEntry]]

    const response = await app.request('/api/v1/admin/audit', {}, env())
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toEqual([auditEntry])
  })
})
