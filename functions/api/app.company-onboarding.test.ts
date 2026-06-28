import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppBindings } from './lib/types'

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createClerkClient: vi.fn(),
  drizzle: vi.fn(),
  selectResults: [] as unknown[][],
  inserts: [] as unknown[],
  updates: [] as unknown[],
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
  returning: () => Promise<unknown[]>
}

type ApiJson = {
  data?: unknown
  error?: {
    code?: string
  }
}

const companyId = '11111111-1111-4111-8111-111111111111'
const electricalCategoryId = '10000000-0000-4000-8000-000000000001'
const plumbingCategoryId = '10000000-0000-4000-8000-000000000005'

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
    returning: () => promise,
    then: promise.then.bind(promise),
  }
  return query
}

function db() {
  return {
    select: vi.fn(() => queryFor(mocks.selectResults.shift() ?? [])),
    insert: vi.fn(() => insertQuery()),
    update: vi.fn(() => updateQuery()),
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
    name: 'Brightline Electrical Group',
    slug: 'brightline-electrical-group',
    description:
      'Licensed residential and light-commercial electrical work with organized project handoffs.',
    licenseNumber: 'ELE-20481',
    website: 'https://example.com/brightline',
    phone: '312-555-0101',
    email: 'hello@brightline.example',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    serviceRadiusMiles: 35,
    status: 'draft',
    createdAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-06-15T00:00:00.000Z',
    ...overrides,
  }
}

function serviceCategory(id: string, name: string, slug: string) {
  return { id, name, slug }
}

function searchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: companyId,
    name: 'Brightline Electrical Group',
    slug: 'brightline-electrical-group',
    description:
      'Licensed residential and light-commercial electrical work with organized project handoffs.',
    city: 'Chicago',
    state: 'IL',
    serviceRadiusMiles: 35,
    licenseNumber: 'ELE-20481',
    serviceState: 'IL',
    category: 'Electrical',
    rating: 0,
    reviewCount: 0,
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

describe('company onboarding workflow routes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.clearAllMocks()
    mocks.selectResults = []
    mocks.inserts = []
    mocks.updates = []
    mocks.batches = []
    mocks.createClerkClient.mockReturnValue({
      authenticateRequest: mocks.authenticateRequest,
    })
    mocks.drizzle.mockReturnValue(db())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a company draft with service categories and service states', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [
        serviceCategory(electricalCategoryId, 'Electrical', 'electrical'),
        serviceCategory(plumbingCategoryId, 'Plumbing', 'plumbing'),
      ],
    ]

    const response = await app.request(
      '/api/v1/companies',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Brightline Electrical Group',
          description:
            'Licensed residential and light-commercial electrical work with organized project handoffs.',
          licenseNumber: 'ELE-20481',
          website: 'https://example.com/brightline',
          phone: '312-555-0101',
          email: 'hello@brightline.example',
          city: 'Chicago',
          state: 'IL',
          zip: '60601',
          serviceRadiusMiles: 35,
          serviceStates: ['IL', 'WI'],
          serviceCategoryIds: [electricalCategoryId, plumbingCategoryId],
        }),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(201)
    expect(body.data).toMatchObject({
      status: 'draft',
      serviceStates: ['IL', 'WI'],
      serviceCategoryIds: [electricalCategoryId, plumbingCategoryId],
    })
    expect(mocks.inserts[0]).toMatchObject({
      name: 'Brightline Electrical Group',
      status: 'draft',
    })
    expect(mocks.inserts[1]).toMatchObject({
      userId: 'contractor_1',
      role: 'company_admin',
    })
    expect(mocks.inserts[2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ state: 'IL', city: 'Chicago', zip: '60601' }),
        expect.objectContaining({ state: 'WI', city: 'Statewide', zip: null }),
      ]),
    )
    expect(mocks.inserts[3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryId: electricalCategoryId, active: true }),
        expect.objectContaining({ categoryId: plumbingCategoryId, active: true }),
      ]),
    )
    expect(mocks.inserts[4]).toMatchObject({
      actorId: 'contractor_1',
      action: 'company.created',
      targetType: 'company',
    })
  })

  it('submits a complete structured profile for verification without documents', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [{ companyId, userId: 'contractor_1', role: 'company_admin', status: 'active' }],
      [companyRecord()],
      [{ state: 'IL' }],
      [{ id: 'service_1' }],
    ]

    const response = await app.request(
      `/api/v1/companies/${companyId}/submit-verification`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer session' },
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ id: companyId, status: 'pending' })
    expect(mocks.updates[0]).toMatchObject({ status: 'pending' })
    expect(mocks.inserts[0]).toMatchObject({
      actorId: 'contractor_1',
      action: 'company.verification_submitted',
      targetType: 'company',
      targetId: companyId,
    })
  })

  it('returns an approved company from public marketplace search', async () => {
    mocks.selectResults = [[searchRow()]]

    const response = await app.request(
      '/api/v1/companies?q=Brightline&state=IL',
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
        id: companyId,
        name: 'Brightline Electrical Group',
        verified: true,
        categories: ['Electrical'],
      }),
    ])
  })
})
