import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppBindings } from './lib/types'

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createClerkClient: vi.fn(),
  drizzle: vi.fn(),
  selectResults: [] as unknown[][],
  inserts: [] as unknown[],
  updates: [] as unknown[],
  deletes: 0,
  batches: [] as unknown[][],
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
  leftJoin: () => Query
  where: () => Query
  groupBy: () => Query
  orderBy: () => Query
  limit: () => Promise<unknown[]>
}

type InsertQuery = PromiseLike<unknown> & {
  values: (value: unknown) => InsertQuery
}

type UpdateQuery = PromiseLike<unknown[]> & {
  set: (value: unknown) => UpdateQuery
  where: () => UpdateQuery
}

type DeleteQuery = PromiseLike<unknown> & {
  where: () => DeleteQuery
}

type ApiJson = {
  data?: unknown
  error?: {
    code?: string
  }
}

const companyId = '11111111-1111-4111-8111-111111111111'

function queryFor(rows: unknown[]): Query {
  const promise = Promise.resolve(rows)
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    where: () => query,
    groupBy: () => query,
    orderBy: () => query,
    limit: () => promise,
    then: promise.then.bind(promise),
  }
  return query
}

function insertQuery(): InsertQuery {
  let value: unknown
  const resolve = () => Promise.resolve(value)
  const query = {
    values: (nextValue: unknown) => {
      value = nextValue
      mocks.inserts.push(nextValue)
      return query
    },
    then: <TResult1 = unknown, TResult2 = never>(
      onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => resolve().then(onFulfilled, onRejected),
  }
  return query
}

function updateQuery(): UpdateQuery {
  const promise = Promise.resolve([])
  const query = {
    set: (value: unknown) => {
      mocks.updates.push(value)
      return query
    },
    where: () => query,
    then: promise.then.bind(promise),
  }
  return query
}

function deleteQuery(): DeleteQuery {
  const promise = Promise.resolve(undefined)
  const query = {
    where: () => {
      mocks.deletes += 1
      return query
    },
    then: promise.then.bind(promise),
  }
  return query
}

function db() {
  return {
    select: vi.fn(() => queryFor(mocks.selectResults.shift() ?? [])),
    insert: vi.fn(() => insertQuery()),
    update: vi.fn(() => updateQuery()),
    delete: vi.fn(() => deleteQuery()),
    batch: vi.fn(async (items: unknown[]) => {
      mocks.batches.push(items)
      return Promise.all(items as Array<PromiseLike<unknown>>)
    }),
  }
}

function env(overrides: Partial<AppBindings> = {}): AppBindings {
  return {
    DB: {} as D1Database,
    ENVIRONMENT: 'preview',
    PUBLIC_APP_NAME: 'Contractor Marketplace',
    PUBLIC_APP_URL: 'https://preview.contractor-marketplace.pages.dev',
    VITE_PUBLIC_APP_NAME: 'Contractor Marketplace',
    VITE_PUBLIC_APP_URL: 'https://preview.contractor-marketplace.pages.dev',
    PILOT_MARKET: 'Chicago',
    ALLOW_DEMO_AUTH: 'false',
    CLERK_SECRET_KEY: 'sk_test',
    CLERK_PUBLISHABLE_KEY: 'pk_test',
    CLERK_JWT_KEY: 'jwt-key',
    ...overrides,
  } as AppBindings
}

function userRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contractor_1',
    clerkUserId: 'clerk_contractor_1',
    name: 'Alex Rivera',
    email: 'contractor@example.com',
    platformRole: 'buyer',
    status: 'active',
    ...overrides,
  }
}

function companyRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: companyId,
    name: 'Lakefront Electric Co.',
    status: 'verified',
    ...overrides,
  }
}

function searchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: companyId,
    name: 'Lakefront Electric Co.',
    slug: 'lakefront-electric',
    description: 'Licensed residential and light-commercial electrical work across Chicago.',
    city: 'Chicago',
    state: 'IL',
    serviceRadiusMiles: 28,
    licenseNumber: 'ECC-10482',
    serviceState: 'IL',
    category: 'Electrical',
    rating: 4.9,
    reviewCount: 12,
    ...overrides,
  }
}

function mockAuthenticatedClerkUser(userId = 'clerk_contractor_1') {
  mocks.authenticateRequest.mockResolvedValue({
    isAuthenticated: true,
    toAuth: () => ({ userId }),
  })
}

async function readJson(response: Response): Promise<ApiJson> {
  const body: unknown = await response.json()
  return body as ApiJson
}

function insertedWhere(predicate: (value: Record<string, unknown>) => boolean) {
  return mocks.inserts.find(
    (value): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && predicate(value as Record<string, unknown>),
  )
}

describe('company service state routes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.clearAllMocks()
    mocks.selectResults = []
    mocks.inserts = []
    mocks.updates = []
    mocks.deletes = 0
    mocks.batches = []
    mocks.createClerkClient.mockReturnValue({
      authenticateRequest: mocks.authenticateRequest,
    })
    mocks.drizzle.mockReturnValue(db())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows a company admin to save multiple service states', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [{ companyId, userId: 'contractor_1', role: 'company_admin', status: 'active' }],
      [companyRecord()],
      [{ state: 'IL' }],
    ]

    const response = await app.request(
      `/api/v1/companies/${companyId}/service-states`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer session',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ states: ['IL', 'IN', 'WI'] }),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({
      id: companyId,
      states: ['IL', 'IN', 'WI'],
      status: 'pending',
    })
    expect(mocks.deletes).toBe(1)
    expect(mocks.updates[0]).toMatchObject({ status: 'pending' })
    expect(insertedWhere((value) => value.state === 'IN')).toMatchObject({
      companyId,
      city: 'Statewide',
      zip: null,
      radiusMiles: null,
    })
    expect(insertedWhere((value) => value.state === 'WI')).toMatchObject({
      companyId,
      city: 'Statewide',
    })
    expect(
      insertedWhere((value) => value.action === 'company.service_states_updated'),
    ).toMatchObject({
      targetType: 'company',
      companyId,
    })
  })

  it('rejects service state updates for non-members across tenants', async () => {
    mockAuthenticatedClerkUser('clerk_buyer_1')
    mocks.selectResults = [[userRecord({ id: 'buyer_1', clerkUserId: 'clerk_buyer_1' })], []]

    const response = await app.request(
      `/api/v1/companies/${companyId}/service-states`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer session',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ states: ['IL', 'IN'] }),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(403)
    expect(body.error?.code).toBe('company_access_denied')
    expect(mocks.deletes).toBe(0)
    expect(mocks.inserts).toHaveLength(0)
  })

  it('rejects invalid service state codes', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [{ companyId, userId: 'contractor_1', role: 'company_admin', status: 'active' }],
    ]

    const response = await app.request(
      `/api/v1/companies/${companyId}/service-states`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer session',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ states: ['IL', 'ZZ'] }),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(422)
    expect(body.error?.code).toBe('invalid_service_states')
    expect(mocks.deletes).toBe(0)
    expect(mocks.inserts).toHaveLength(0)
  })
})

describe('public company search service state filtering', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.clearAllMocks()
    mocks.selectResults = []
    mocks.inserts = []
    mocks.updates = []
    mocks.deletes = 0
    mocks.batches = []
    mocks.drizzle.mockReturnValue(db())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns businesses servicing the selected state and excludes the rest', async () => {
    mocks.selectResults = [
      [
        searchRow({ serviceState: 'IN' }),
        searchRow({
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Prairie & Stone Builders',
          slug: 'prairie-stone-builders',
          city: 'Oak Park',
          state: 'IN',
          serviceState: 'IL',
          category: 'Remodeling',
        }),
      ],
    ]

    const response = await app.request(
      '/api/v1/companies?state=IN',
      {},
      env({
        CLERK_SECRET_KEY: undefined,
        CLERK_PUBLISHABLE_KEY: undefined,
      }),
    )
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toEqual([
      expect.objectContaining({
        name: 'Lakefront Electric Co.',
        categories: ['Electrical'],
      }),
    ])
  })

  it('returns an empty list when no business services the selected state', async () => {
    mocks.selectResults = [[searchRow({ state: 'TX', serviceState: 'IL' })]]

    const response = await app.request(
      '/api/v1/companies?state=TX',
      {},
      env({
        CLERK_SECRET_KEY: undefined,
        CLERK_PUBLISHABLE_KEY: undefined,
      }),
    )
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toEqual([])
  })

  it('rejects invalid public state filters', async () => {
    const response = await app.request(
      '/api/v1/companies?state=ZZ',
      {},
      env({
        CLERK_SECRET_KEY: undefined,
        CLERK_PUBLISHABLE_KEY: undefined,
      }),
    )
    const body = await readJson(response)

    expect(response.status).toBe(422)
    expect(body.error?.code).toBe('invalid_query')
    expect(mocks.drizzle).not.toHaveBeenCalled()
  })
})
