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
  orderBy: () => Query
  limit: () => Promise<unknown[]>
}

type InsertQuery = PromiseLike<unknown> & {
  values: (value: unknown) => InsertQuery
  onConflictDoUpdate: () => InsertQuery
  returning: () => Promise<unknown[]>
}

type UpdateQuery = PromiseLike<unknown[]> & {
  set: (value: unknown) => UpdateQuery
  where: () => UpdateQuery
  returning: () => Promise<unknown[]>
}

type DeleteQuery = PromiseLike<unknown> & {
  where: () => DeleteQuery
}

type ApiJson = {
  data?: Record<string, unknown>
  error?: {
    code?: string
  }
}

const companyId = '11111111-1111-4111-8111-111111111111'
const jobId = '22222222-2222-4222-8222-222222222222'
const invoiceId = '33333333-3333-4333-8333-333333333333'
const buyerId = 'buyer_1'

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

function insertQuery(tableRows: unknown[] = []): InsertQuery {
  let value: unknown
  const resolve = () => Promise.resolve(value)
  const query = {
    values: (nextValue: unknown) => {
      value = nextValue
      mocks.inserts.push(nextValue)
      return query
    },
    onConflictDoUpdate: () => query,
    returning: () => Promise.resolve(tableRows),
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

function invoiceRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: invoiceId,
    rootInvoiceId: invoiceId,
    previousRevisionId: null,
    revisionNumber: 1,
    jobId,
    companyId,
    buyerId,
    createdBy: 'admin_1',
    invoiceNumber: 'INV-2026-00001',
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
    subtotalCents: 120000,
    taxRateBps: 0,
    taxCents: 0,
    discountCents: 0,
    retainageRateBps: 0,
    retainageCents: 0,
    totalCents: 120000,
    amountPaidCents: 0,
    status: 'sent',
    notes: 'Thanks for choosing us.',
    sentAt: '2026-06-02T12:00:00.000Z',
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    pdfFileId: 'file_previous_pdf',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-02T12:00:00.000Z',
    ...overrides,
  }
}

function invoiceItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item_1',
    invoiceId,
    description: 'Install new service panel',
    quantityMilli: 1000,
    unitPriceCents: 120000,
    lineTotalCents: 120000,
    itemType: 'labor',
    sortOrder: 0,
    ...overrides,
  }
}

function invoiceInput() {
  return {
    jobId,
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
    taxRateBps: 0,
    discountCents: 0,
    retainageRateBps: 0,
    notes: 'Updated scope note.',
    items: [
      {
        description: 'Install new service panel',
        quantityMilli: 1000,
        unitPriceCents: 120000,
        itemType: 'labor',
      },
    ],
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

function insertedWhere(predicate: (value: Record<string, unknown>) => boolean) {
  return mocks.inserts.find(
    (value): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && predicate(value as Record<string, unknown>),
  )
}

describe('invoice and review launch-blocker routes', () => {
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

  it('keeps sent invoices immutable through the update endpoint', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [[userRecord()], [invoiceRecord({ status: 'sent' })]]

    const response = await app.request(
      `/api/v1/invoices/${invoiceId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceInput()),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(409)
    expect(body.error?.code).toBe('invoice_immutable')
    expect(mocks.updates).toHaveLength(0)
    expect(mocks.inserts).toHaveLength(0)
  })

  it('creates invoice revisions as fresh drafts without mutating the sent invoice', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [invoiceRecord()],
      [{ revisionNumber: 1 }],
      [invoiceItem()],
    ]

    const response = await app.request(
      `/api/v1/invoices/${invoiceId}/revisions`,
      { method: 'POST' },
      env(),
    )
    const body = await readJson(response)
    const revision = insertedWhere(
      (value) =>
        value.previousRevisionId === invoiceId && value.invoiceNumber === 'INV-2026-00001-R2',
    )

    expect(response.status).toBe(201)
    expect(body.data).toMatchObject({
      invoiceNumber: 'INV-2026-00001-R2',
      revisionNumber: 2,
      status: 'draft',
    })
    expect(revision).toMatchObject({
      rootInvoiceId: invoiceId,
      previousRevisionId: invoiceId,
      revisionNumber: 2,
      status: 'draft',
      amountPaidCents: 0,
      sentAt: null,
      viewedAt: null,
      paidAt: null,
      voidedAt: null,
      pdfFileId: null,
    })
    expect(insertedWhere((value) => value.action === 'invoice.revision_created')).toMatchObject({
      targetType: 'invoice',
      companyId,
    })
  })

  it('sends invoices without requiring PDF storage and records failed email delivery', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [invoiceRecord({ status: 'draft', sentAt: null, pdfFileId: null })],
      [],
      [
        {
          id: jobId,
          companyId,
          buyerId,
          title: 'Service panel upgrade',
          status: 'awaiting_invoice',
        },
      ],
      [{ id: companyId, name: 'Northside Electric' }],
      [{ id: buyerId, name: 'Jordan Rivera', email: 'jordan@example.com' }],
    ]

    const response = await app.request(
      `/api/v1/invoices/${invoiceId}/send`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': 'invoice-send-001' },
        body: '{}',
      },
      env(),
    )
    const body = await readJson(response)
    const storedFile = insertedWhere(
      (value) => value.invoiceId === invoiceId && value.mimeType === 'application/pdf',
    )
    const sentUpdate = mocks.updates.find(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        (value as Record<string, unknown>).status === 'sent',
    ) as Record<string, unknown> | undefined
    const failedEmailUpdate = mocks.updates.find(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        (value as Record<string, unknown>).lastErrorCode === 'provider_not_configured',
    )

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ id: invoiceId, status: 'sent' })
    expect(body.data?.pdfFileId).toBeUndefined()
    expect(storedFile).toBeUndefined()
    expect(sentUpdate).toMatchObject({ status: 'sent' })
    expect(failedEmailUpdate).toMatchObject({
      status: 'failed',
      lastErrorCode: 'provider_not_configured',
      attempts: 1,
    })
  })

  it('records manual invoice payments and closes the job when the balance reaches zero', async () => {
    mockAuthenticatedClerkUser()
    mocks.selectResults = [
      [userRecord()],
      [invoiceRecord({ status: 'viewed', totalCents: 120000, amountPaidCents: 20000 })],
      [],
    ]

    const response = await app.request(
      `/api/v1/invoices/${invoiceId}/payments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'payment-record-001',
        },
        body: JSON.stringify({
          amountCents: 100000,
          paidAt: '2026-06-20T12:00:00.000Z',
          method: 'check',
          reference: 'check 1005',
        }),
      },
      env(),
    )
    const body = await readJson(response)
    const payment = insertedWhere(
      (value) => value.invoiceId === invoiceId && value.method === 'check',
    )

    expect(response.status).toBe(201)
    expect(body.data).toMatchObject({
      invoiceId,
      amountPaidCents: 120000,
      balanceCents: 0,
      status: 'paid',
    })
    expect(payment).toMatchObject({
      invoiceId,
      recordedBy: 'admin_1',
      amountCents: 100000,
      method: 'check',
      reference: 'check 1005',
    })
    expect(mocks.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amountPaidCents: 120000, status: 'paid' }),
        expect.objectContaining({ status: 'paid' }),
      ]),
    )
  })

  it('allows only the buyer on completed jobs to create reviews', async () => {
    mockAuthenticatedClerkUser('clerk_buyer_1')
    mocks.selectResults = [
      [userRecord({ id: buyerId, clerkUserId: 'clerk_buyer_1', platformRole: 'buyer' })],
      [{ id: jobId, buyerId, companyId, status: 'paid' }],
    ]

    const response = await app.request(
      '/api/v1/reviews',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          rating: 5,
          comment: 'Clear communication and a clean finish.',
        }),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(201)
    expect(body.data).toMatchObject({ status: 'published' })
    expect(insertedWhere((value) => value.jobId === jobId && value.rating === 5)).toMatchObject({
      buyerId,
      companyId,
      status: 'published',
    })
    expect(insertedWhere((value) => value.action === 'review.created')).toMatchObject({
      targetType: 'review',
      companyId,
    })
  })

  it('denies reviews for jobs outside the buyer tenant or before completion', async () => {
    mockAuthenticatedClerkUser('clerk_buyer_1')
    mocks.selectResults = [
      [userRecord({ id: buyerId, clerkUserId: 'clerk_buyer_1', platformRole: 'buyer' })],
      [],
    ]

    const response = await app.request(
      '/api/v1/reviews',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          rating: 4,
          comment: 'Good work after the project wrapped.',
        }),
      },
      env(),
    )
    const body = await readJson(response)

    expect(response.status).toBe(403)
    expect(body.error?.code).toBe('review_not_allowed')
    expect(mocks.inserts).toHaveLength(0)
  })
})
