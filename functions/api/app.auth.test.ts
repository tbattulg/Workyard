import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppBindings } from './lib/types'

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createClerkClient: vi.fn(),
  drizzle: vi.fn(),
  queryResults: [] as unknown[][],
}))

vi.mock('@clerk/backend', () => ({
  createClerkClient: mocks.createClerkClient,
}))

vi.mock('drizzle-orm/d1', () => ({
  drizzle: mocks.drizzle,
}))

import { app } from './app'

type Query = PromiseLike<unknown[]> & {
  from: () => Query
  innerJoin: () => Query
  where: () => Query
  limit: () => Promise<unknown[]>
}

type ApiJson = {
  data?: Record<string, unknown>
  error?: {
    code?: string
  }
}

function queryFor(rows: unknown[]): Query {
  const promise = Promise.resolve(rows)
  const query = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    limit: () => promise,
    then: promise.then.bind(promise),
  }
  return query
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
    id: 'user_1',
    clerkUserId: 'clerk_user_1',
    name: 'Jordan Rivera',
    email: 'jordan@example.com',
    platformRole: 'buyer',
    status: 'active',
    ...overrides,
  }
}

function mockAuthenticatedClerkUser(userId = 'clerk_user_1') {
  mocks.authenticateRequest.mockResolvedValue({
    isAuthenticated: true,
    toAuth: () => ({ userId }),
  })
}

async function requestMe(bindings = env()) {
  return app.request('/api/v1/me', { headers: { Authorization: 'Bearer session' } }, bindings)
}

async function readJson(response: Response): Promise<ApiJson> {
  const body: unknown = await response.json()
  return body as ApiJson
}

describe('/api/v1/me auth behavior', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.clearAllMocks()
    mocks.queryResults = []
    mocks.createClerkClient.mockReturnValue({
      authenticateRequest: mocks.authenticateRequest,
    })
    mocks.drizzle.mockReturnValue({
      select: vi.fn(() => queryFor(mocks.queryResults.shift() ?? [])),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the signed-in active Clerk user from D1 roles', async () => {
    mockAuthenticatedClerkUser()
    mocks.queryResults = [[userRecord()], []]

    const response = await requestMe()
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({
      id: 'user_1',
      clerkUserId: 'clerk_user_1',
      role: 'buyer',
      status: 'active',
      memberships: [],
    })
    expect(mocks.authenticateRequest).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        authorizedParties: ['https://preview.contractor-marketplace.pages.dev'],
        jwtKey: 'jwt-key',
      }),
    )
  })

  it('returns authentication_required when no Clerk session is present', async () => {
    mocks.authenticateRequest.mockResolvedValue({ isAuthenticated: false })

    const response = await requestMe()
    const body = await readJson(response)

    expect(response.status).toBe(401)
    expect(body.error?.code).toBe('authentication_required')
  })

  it('returns authentication_required when the Clerk user has not synced to D1', async () => {
    mockAuthenticatedClerkUser('clerk_missing')
    mocks.queryResults = [[]]

    const response = await requestMe()
    const body = await readJson(response)

    expect(response.status).toBe(401)
    expect(body.error?.code).toBe('authentication_required')
  })

  it.each(['suspended', 'deleted'] as const)(
    'returns account_unavailable for %s local users',
    async (status) => {
      mockAuthenticatedClerkUser()
      mocks.queryResults = [[userRecord({ status })]]

      const response = await requestMe()
      const body = await readJson(response)

      expect(response.status).toBe(403)
      expect(body.error?.code).toBe('account_unavailable')
    },
  )

  it('rejects x-demo-user in production even if demo auth is enabled', async () => {
    const response = await app.request(
      '/api/v1/me',
      { headers: { 'X-Demo-User': 'demo_admin' } },
      env({
        ENVIRONMENT: 'production',
        ALLOW_DEMO_AUTH: 'true',
        CLERK_SECRET_KEY: undefined,
        CLERK_PUBLISHABLE_KEY: undefined,
      }),
    )
    const body = await readJson(response)

    expect(response.status).toBe(401)
    expect(body.error?.code).toBe('authentication_required')
    expect(mocks.drizzle).not.toHaveBeenCalled()
  })
})
