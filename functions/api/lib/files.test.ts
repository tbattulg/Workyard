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

import { canAccessFile, requireFileStorage, validateFile } from './files'

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

function context(filesBinding?: R2Bucket) {
  return {
    env: {
      DB: {} as D1Database,
      FILES: filesBinding,
    },
  } as Context<AppEnv>
}

const buyer: Actor = {
  id: 'buyer_1',
  clerkUserId: 'clerk_buyer_1',
  name: 'Buyer One',
  email: 'buyer@example.com',
  role: 'buyer',
  status: 'active',
}

const staff: Actor = {
  id: 'staff_1',
  clerkUserId: 'clerk_staff_1',
  name: 'Staff One',
  email: 'staff@example.com',
  role: 'staff',
  status: 'active',
}

function file(overrides: Record<string, unknown> = {}) {
  return {
    id: 'file_1',
    ownerUserId: 'owner_1',
    companyId: null,
    quoteRequestId: null,
    jobId: null,
    scanStatus: 'clean',
    deletedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.queryResults = []
  mocks.drizzle.mockReturnValue({
    select: vi.fn(() => queryFor(mocks.queryResults.shift() ?? [])),
  })
})

describe('validateFile', () => {
  it('accepts supported files when declared type matches magic bytes', () => {
    expect(validateFile(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg')).toBe('image/jpeg')
    expect(validateFile(new TextEncoder().encode('%PDF-1.7'), 'application/pdf')).toBe(
      'application/pdf',
    )
  })

  it('rejects content-type spoofing', () => {
    expect(() => validateFile(new TextEncoder().encode('%PDF-1.7'), 'image/png')).toThrow(
      'file content does not match',
    )
  })
})

describe('requireFileStorage', () => {
  it('fails clearly when R2 is not configured', () => {
    expect(() => requireFileStorage(context())).toThrow('File storage is not configured')
  })
})

describe('canAccessFile', () => {
  it('allows the file owner to access private files', async () => {
    const ownedFile = file({ ownerUserId: buyer.id })
    mocks.queryResults = [[ownedFile]]

    await expect(canAccessFile(context(), buyer, 'file_1')).resolves.toBe(ownedFile)
  })

  it('denies cross-tenant access to private files', async () => {
    mocks.queryResults = [[file({ ownerUserId: 'other_user' })]]

    await expect(canAccessFile(context(), buyer, 'file_1')).rejects.toMatchObject({
      status: 403,
      code: 'file_access_denied',
    })
  })

  it('allows assigned staff to access job participant files', async () => {
    const jobFile = file({ companyId: 'company_1', jobId: 'job_1', ownerUserId: 'buyer_1' })
    mocks.queryResults = [
      [jobFile],
      [],
      [{ companyId: 'company_1', role: 'staff' }],
      [{ jobId: 'job_1' }],
    ]

    await expect(canAccessFile(context(), staff, 'file_1')).resolves.toBe(jobFile)
  })
})
