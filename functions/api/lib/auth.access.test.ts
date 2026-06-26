import type { Context } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor, AppEnv } from './types'

const mocks = vi.hoisted(() => ({
  drizzle: vi.fn(),
  queryResults: [] as unknown[][],
}))

vi.mock('drizzle-orm/d1', () => ({
  drizzle: mocks.drizzle,
}))

import {
  requireCompanyMember,
  requireJobCompanyAccess,
  requireQuoteCompanyAccess,
} from './auth'

type Query = PromiseLike<unknown[]> & {
  from: () => Query
  where: () => Query
  limit: () => Promise<unknown[]>
}

function queryFor(rows: unknown[]): Query {
  const promise = Promise.resolve(rows)
  const query = {
    from: () => query,
    where: () => query,
    limit: () => promise,
    then: promise.then.bind(promise),
  }
  return query
}

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: 'staff_1',
    clerkUserId: 'clerk_staff_1',
    name: 'Staff One',
    email: 'staff@example.com',
    role: 'staff',
    status: 'active',
    ...overrides,
  }
}

function context(currentActor: Actor | null) {
  return {
    env: { DB: {} as D1Database },
    get: (key: string) => (key === 'actor' ? currentActor : undefined),
  } as Context<AppEnv>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.queryResults = []
  mocks.drizzle.mockReturnValue({
    select: vi.fn(() => queryFor(mocks.queryResults.shift() ?? [])),
  })
})

describe('company access guards', () => {
  it('lets platform admins access company records without membership lookup', async () => {
    const admin = actor({ id: 'admin_1', role: 'platform_admin' })

    await expect(requireCompanyMember(context(admin), 'company_1')).resolves.toMatchObject({
      actor: admin,
      companyRole: 'company_admin',
    })
    expect(mocks.drizzle).not.toHaveBeenCalled()
  })

  it('allows active company members with an allowed role', async () => {
    mocks.queryResults = [[{ companyId: 'company_1', userId: 'staff_1', role: 'staff' }]]

    await expect(requireCompanyMember(context(actor()), 'company_1')).resolves.toMatchObject({
      companyRole: 'staff',
    })
  })

  it('denies users without active company membership', async () => {
    mocks.queryResults = [[]]

    await expect(requireCompanyMember(context(actor()), 'company_1')).rejects.toMatchObject({
      status: 403,
      code: 'company_access_denied',
    })
  })

  it.each(['suspended', 'deleted'] as const)(
    'blocks %s users before company membership checks',
    async (status) => {
      await expect(
        requireCompanyMember(context(actor({ status })), 'company_1'),
      ).rejects.toMatchObject({
        status: 403,
        code: 'account_unavailable',
      })
      expect(mocks.drizzle).not.toHaveBeenCalled()
    },
  )
})

describe('quote company access guards', () => {
  it('allows staff assigned to the lead', async () => {
    mocks.queryResults = [[{ companyId: 'company_1', userId: 'staff_1', role: 'staff' }]]

    await expect(
      requireQuoteCompanyAccess(context(actor()), 'company_1', 'staff_1'),
    ).resolves.toMatchObject({ companyRole: 'staff' })
  })

  it('denies staff when a lead is assigned to another team member', async () => {
    mocks.queryResults = [[{ companyId: 'company_1', userId: 'staff_1', role: 'staff' }]]

    await expect(
      requireQuoteCompanyAccess(context(actor()), 'company_1', 'staff_2'),
    ).rejects.toMatchObject({
      status: 403,
      code: 'lead_assignment_required',
    })
  })
})

describe('job company access guards', () => {
  it('allows staff assigned to the job', async () => {
    mocks.queryResults = [
      [{ companyId: 'company_1', userId: 'staff_1', role: 'staff' }],
      [{ jobId: 'job_1' }],
    ]

    await expect(
      requireJobCompanyAccess(context(actor()), 'company_1', 'job_1'),
    ).resolves.toMatchObject({ companyRole: 'staff' })
  })

  it('denies staff who are not assigned to the job', async () => {
    mocks.queryResults = [[{ companyId: 'company_1', userId: 'staff_1', role: 'staff' }], []]

    await expect(
      requireJobCompanyAccess(context(actor()), 'company_1', 'job_1'),
    ).rejects.toMatchObject({
      status: 403,
      code: 'job_assignment_required',
    })
  })
})
