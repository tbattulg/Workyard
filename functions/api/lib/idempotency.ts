import { and, eq, gt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { Context } from 'hono'
import { idempotencyKeys } from '../../../shared/db/schema'
import { HttpError } from './http'
import type { Actor, AppEnv } from './types'

async function hashRequest(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function executeIdempotently<T>(
  c: Context<AppEnv>,
  actor: Actor,
  operation: string,
  body: string,
  execute: () => Promise<T>,
): Promise<{ value: T; replayed: boolean }> {
  const key = c.req.header('idempotency-key')
  if (!key || key.length < 8 || key.length > 120) {
    throw new HttpError(
      422,
      'idempotency_key_required',
      'Provide an Idempotency-Key header between 8 and 120 characters.',
    )
  }
  const requestHash = await hashRequest(body)
  const db = drizzle(c.env.DB)
  const now = new Date().toISOString()
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.key, key),
        eq(idempotencyKeys.actorId, actor.id),
        eq(idempotencyKeys.operation, operation),
        gt(idempotencyKeys.expiresAt, now),
      ),
    )
    .limit(1)
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(
        409,
        'idempotency_conflict',
        'This idempotency key was used with different request data.',
      )
    }
    return { value: JSON.parse(existing.responseJson) as T, replayed: true }
  }

  const value = await execute()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await db.insert(idempotencyKeys).values({
    key,
    actorId: actor.id,
    operation,
    requestHash,
    responseJson: JSON.stringify(value),
    statusCode: 200,
    createdAt: now,
    expiresAt,
  })
  return { value, replayed: false }
}
