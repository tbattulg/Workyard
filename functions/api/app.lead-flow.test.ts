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
  orderBy: () => Query
  limit: () => Promise<unknown[]>
}

type InsertQuery = PromiseLike<unknown> & {
  values: (value: unknown) => InsertQuery
  onConflictDoNothing: () => InsertQuery
}

type UpdateQuery = PromiseLike<unknown[]> & {
  set: (value: unknown) => UpdateQuery
  where: () => UpdateQuery
  returning: () => Promise<unknown[]>
}

type ApiJson = {
  data?: Record<string, unknown>
  error?: {
    code?: string
  }
}

const buyerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const contractorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const otherBuyerId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const companyId = '11111111-1111-4111-8111-111111111111'
const otherCompanyId = '22222222-2222-4222-8222-222222222222'
const serviceId = '20000000-0000-4000-8000-000000000001'
const quoteId = '33333333-3333-4333-8333-333333333333'
const proposalId = '44444444-4444-4444-8444-444444444444'
const threadId = '55555555-5555-4555-8555-555555555555'

function queryFor(rows: unknown[]): Query {
  const promise = Promise.resolve(rows)
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    where: () => query,
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
    onConflictDoNothing: () => query,
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
    id: buyerId,
    clerkUserId: 'clerk_buyer',
    name: 'Jordan Lee',
    email: 'buyer@example.com',
    platformRole: 'buyer',
    status: 'active',
    ...overrides,
  }
}

function quoteRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: quoteId,
    buyerId,
    companyId,
    assignedToUserId: null,
    serviceId,
    name: 'Jordan Lee',
    email: 'buyer@example.com',
    phone: '312-555-0144',
    projectAddress: '1234 W Grand Ave',
    projectCity: 'Denver',
    projectState: 'CO',
    projectZip: '80202',
    projectType: 'Electrical panel upgrade',
    jobDescription: 'Replace a damaged electrical panel and inspect the service entrance.',
    preferredStartDate: '2026-07-10',
    budgetMinCents: 250000,
    budgetMaxCents: 1000000,
    status: 'ready_for_proposal',
    createdAt: '2026-06-27T12:00:00.000Z',
    updatedAt: '2026-06-27T12:00:00.000Z',
    ...overrides,
  }
}

function proposalRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: proposalId,
    quoteRequestId: quoteId,
    companyId,
    createdBy: contractorId,
    title: 'Electrical panel upgrade',
    summary: 'Replace the panel, label circuits, and coordinate one inspection.',
    subtotalCents: 850000,
    priceType: 'range',
    priceMinCents: 750000,
    priceMaxCents: 850000,
    assumptions: 'Drywall repairs are excluded.',
    validUntil: '2026-07-20',
    notes: 'Earliest start is mid-July.',
    status: 'sent',
    sentAt: '2026-06-27T14:00:00.000Z',
    respondedAt: null,
    createdAt: '2026-06-27T13:00:00.000Z',
    updatedAt: '2026-06-27T14:00:00.000Z',
    ...overrides,
  }
}

function mockAuthenticatedClerkUser(userId = 'clerk_buyer') {
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

function updateWhere(predicate: (value: Record<string, unknown>) => boolean) {
  return mocks.updates.find(
    (value): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && predicate(value as Record<string, unknown>),
  )
}

describe('buyer to contractor lead flow routes', () => {
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

  it('submits a quote request to a verified company service without file attachments', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [],
      [{ id: companyId }],
      [{ id: serviceId }],
      [{ userId: contractorId }],
    ]

    const response = await app.request(
      '/api/v1/quotes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'quote-create-001',
        },
        body: JSON.stringify({
          companyId,
          serviceId,
          name: 'Jordan Lee',
          email: 'buyer@example.com',
          phone: '312-555-0144',
          projectAddress: '1234 W Grand Ave',
          projectCity: 'Denver',
          projectState: 'CO',
          projectZip: '80202',
          projectType: 'Electrical panel upgrade',
          jobDescription: 'Replace a damaged electrical panel and inspect the service entrance.',
          preferredStartDate: '2026-07-10',
          budgetMinCents: 250000,
          budgetMaxCents: 1000000,
        }),
      },
      env(),
    )
    const body = await readJson(response)
    const quote = insertedWhere((value) => value.projectType === 'Electrical panel upgrade')

    expect(response.status).toBe(201)
    expect(body.data).toMatchObject({ status: 'new' })
    expect(quote).toMatchObject({
      buyerId,
      companyId,
      serviceId,
      projectType: 'Electrical panel upgrade',
      status: 'new',
    })
    expect(updateWhere((value) => value.quoteRequestId === body.data?.id)).toBeUndefined()
    expect(insertedWhere((value) => value.action === 'quote.created')).toMatchObject({
      targetType: 'quote_request',
      companyId,
    })
  })

  it('lets a company member mark an assigned lead ready for proposal', async () => {
    mockAuthenticatedClerkUser('clerk_contractor')
    mocks.selectResults = [
      [userRecord({ id: contractorId, clerkUserId: 'clerk_contractor' })],
      [quoteRecord({ status: 'viewed', assignedToUserId: contractorId })],
      [{ companyId, userId: contractorId, role: 'staff', status: 'active' }],
    ]

    const response = await app.request(
      `/api/v1/quotes/${quoteId}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready_for_proposal' }),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ id: quoteId, status: 'ready_for_proposal' })
    expect(updateWhere((value) => value.status === 'ready_for_proposal')).toBeDefined()
    expect(insertedWhere((value) => value.action === 'quote.status_changed')).toMatchObject({
      targetId: quoteId,
      companyId,
    })
  })

  it('creates a lightweight proposal and sends it to the buyer', async () => {
    mockAuthenticatedClerkUser('clerk_contractor')
    mocks.selectResults = [
      [userRecord({ id: contractorId, clerkUserId: 'clerk_contractor' })],
      [quoteRecord()],
      [{ companyId, userId: contractorId, role: 'company_admin', status: 'active' }],
      [],
    ]

    const createResponse = await app.request(
      '/api/v1/proposals',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'proposal-create-001',
        },
        body: JSON.stringify({
          quoteRequestId: quoteId,
          title: 'Electrical panel upgrade',
          summary: 'Replace the panel, label circuits, and coordinate one inspection.',
          priceType: 'range',
          priceMinCents: 750000,
          priceMaxCents: 850000,
          assumptions: 'Drywall repairs are excluded.',
          validUntil: '2026-07-20',
          notes: 'Earliest start is mid-July.',
        }),
      },
      env(),
    )
    const createBody = await readJson(createResponse)
    const proposal = insertedWhere((value) => value.quoteRequestId === quoteId)

    expect(createResponse.status).toBe(201)
    expect(createBody.data).toMatchObject({ status: 'draft', subtotalCents: 850000 })
    expect(proposal).toMatchObject({
      companyId,
      createdBy: contractorId,
      priceType: 'range',
      priceMinCents: 750000,
      priceMaxCents: 850000,
      assumptions: 'Drywall repairs are excluded.',
      notes: 'Earliest start is mid-July.',
    })
    const createdProposalId = createBody.data?.id
    if (typeof createdProposalId !== 'string') throw new Error('Proposal ID was not returned.')

    mocks.selectResults = [
      [userRecord({ id: contractorId, clerkUserId: 'clerk_contractor' })],
      [proposalRecord({ id: createdProposalId, status: 'draft' })],
      [{ companyId, userId: contractorId, role: 'company_admin', status: 'active' }],
      [quoteRecord()],
      [],
    ]
    mocks.inserts = []
    mocks.updates = []

    const sendResponse = await app.request(
      `/api/v1/proposals/${createdProposalId}/send`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': 'proposal-send-001' },
        body: '{}',
      },
      env(),
    )
    const sendBody = await readJson(sendResponse)

    expect(sendResponse.status).toBe(200)
    expect(sendBody.data).toMatchObject({ id: createdProposalId, status: 'sent' })
    expect(updateWhere((value) => value.status === 'sent')).toBeDefined()
    expect(updateWhere((value) => value.status === 'responded')).toBeDefined()
    expect(insertedWhere((value) => value.type === 'proposal_sent')).toMatchObject({
      userId: buyerId,
    })
    expect(insertedWhere((value) => value.action === 'proposal.sent')).toMatchObject({
      targetType: 'proposal',
      companyId,
    })
  })

  it('lets the buyer accept a sent proposal and creates the accepted job', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [proposalRecord()],
      [quoteRecord({ status: 'responded' })],
      [{ id: threadId }],
    ]

    const response = await app.request(
      `/api/v1/proposals/${proposalId}/accept`,
      { method: 'POST' },
      env(),
    )
    const body = await readJson(response)
    const job = insertedWhere((value) => value.acceptedProposalId === proposalId)

    expect(response.status).toBe(201)
    expect(body.data).toMatchObject({ status: 'accepted' })
    expect(updateWhere((value) => value.status === 'accepted')).toBeDefined()
    expect(updateWhere((value) => value.status === 'converted')).toBeDefined()
    expect(job).toMatchObject({
      quoteRequestId: quoteId,
      buyerId,
      companyId,
      threadId,
      status: 'accepted',
    })
    expect(insertedWhere((value) => value.action === 'proposal.accepted')).toMatchObject({
      targetId: proposalId,
      companyId,
    })
  })

  it('lets the buyer decline a sent proposal and closes the quote', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [proposalRecord()],
      [quoteRecord({ status: 'responded' })],
    ]

    const response = await app.request(
      `/api/v1/proposals/${proposalId}/decline`,
      { method: 'POST' },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ id: proposalId, status: 'declined', quoteStatus: 'declined' })
    expect(updateWhere((value) => value.status === 'declined')).toBeDefined()
    expect(insertedWhere((value) => value.type === 'proposal_declined')).toMatchObject({
      userId: contractorId,
    })
    expect(insertedWhere((value) => value.action === 'proposal.declined')).toMatchObject({
      targetId: proposalId,
      companyId,
    })
  })

  it('denies company lead actions outside the actor company boundary', async () => {
    mockAuthenticatedClerkUser('clerk_contractor')
    mocks.selectResults = [
      [userRecord({ id: contractorId, clerkUserId: 'clerk_contractor' })],
      [quoteRecord({ companyId: otherCompanyId, status: 'new' })],
      [],
    ]

    const response = await app.request(
      `/api/v1/quotes/${quoteId}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'viewed' }),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(403)
    expect(body.error?.code).toBe('company_access_denied')
    expect(mocks.updates).toHaveLength(0)
  })

  it('denies proposal acceptance outside the buyer boundary', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [[userRecord()], [proposalRecord()], []]

    const response = await app.request(
      `/api/v1/proposals/${proposalId}/accept`,
      { method: 'POST' },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(403)
    expect(body.error?.code).toBe('proposal_access_denied')
    expect(mocks.updates).toHaveLength(0)
    expect(insertedWhere((value) => value.buyerId === otherBuyerId)).toBeUndefined()
  })
})
