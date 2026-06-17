import { drizzle } from 'drizzle-orm/d1'
import type { Context } from 'hono'
import { auditEvents } from '../../../shared/db/schema'
import type { AppEnv } from './types'

export async function writeAudit(
  c: Context<AppEnv>,
  input: {
    action: string
    targetType: string
    targetId?: string
    companyId?: string
    details?: Record<string, string | number | boolean | null>
  },
) {
  const actor = c.get('actor')
  const db = drizzle(c.env.DB)
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorId: actor?.id,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    companyId: input.companyId,
    requestId: c.get('requestId'),
    detailsJson: JSON.stringify(input.details ?? {}),
    createdAt: new Date().toISOString(),
  })
}
