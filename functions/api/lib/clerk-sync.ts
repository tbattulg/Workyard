import type { UserDeletedJSON, UserJSON, WebhookEvent } from '@clerk/backend'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { users } from '../../../shared/db/schema'
import { USER_ROLES, type UserRole } from '../../../shared/domain'

export type ClerkUserStatus = 'active' | 'suspended' | 'deleted'

export type ClerkUserSyncAction =
  | {
      action: 'upsert'
      clerkUserId: string
      name: string
      email: string
      phone: string | null
      platformRole: UserRole | null
      status: Exclude<ClerkUserStatus, 'deleted'>
    }
  | {
      action: 'delete'
      clerkUserId: string
    }
  | {
      action: 'ignore'
      eventType: string
    }

export class ClerkUserSyncError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ClerkUserSyncError'
  }
}

export function buildClerkUserSyncAction(event: WebhookEvent): ClerkUserSyncAction {
  if (event.type === 'user.created' || event.type === 'user.updated') {
    return buildUpsertAction(event.data)
  }
  if (event.type === 'user.deleted') {
    return buildDeleteAction(event.data)
  }
  return { action: 'ignore', eventType: event.type }
}

function buildUpsertAction(user: UserJSON): Extract<ClerkUserSyncAction, { action: 'upsert' }> {
  const email = getPrimaryEmail(user)
  if (!email) {
    throw new ClerkUserSyncError(
      'clerk_user_missing_email',
      'Clerk user payload does not include a usable primary email address.',
    )
  }

  return {
    action: 'upsert',
    clerkUserId: user.id,
    name: getDisplayName(user, email),
    email,
    phone: getPrimaryPhone(user),
    platformRole: getPlatformRole(user.private_metadata),
    status: user.banned || user.locked ? 'suspended' : 'active',
  }
}

function buildDeleteAction(
  user: UserDeletedJSON,
): Extract<ClerkUserSyncAction, { action: 'delete' }> {
  if (!user.id) {
    throw new ClerkUserSyncError(
      'clerk_user_missing_id',
      'Clerk user deletion payload does not include a user identifier.',
    )
  }
  return { action: 'delete', clerkUserId: user.id }
}

function getPrimaryEmail(user: UserJSON) {
  const primary = user.email_addresses.find(
    (email) => email.id === user.primary_email_address_id,
  )
  return primary?.email_address ?? user.email_addresses[0]?.email_address ?? null
}

function getPrimaryPhone(user: UserJSON) {
  const primary = user.phone_numbers.find((phone) => phone.id === user.primary_phone_number_id)
  return primary?.phone_number ?? user.phone_numbers[0]?.phone_number ?? null
}

function getDisplayName(user: UserJSON, email: string) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (user.username) return user.username
  return email.split('@')[0] || 'Workyard User'
}

function getPlatformRole(metadata: Record<string, unknown> | null | undefined): UserRole | null {
  const candidate = metadata?.platformRole ?? metadata?.platform_role
  return typeof candidate === 'string' && USER_ROLES.includes(candidate as UserRole)
    ? (candidate as UserRole)
    : null
}

export async function applyClerkUserSyncAction(
  dbBinding: D1Database,
  action: ClerkUserSyncAction,
) {
  if (action.action === 'ignore') {
    return { action: 'ignored' as const, eventType: action.eventType }
  }

  const db = drizzle(dbBinding)
  const now = new Date().toISOString()
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, action.clerkUserId))
    .limit(1)

  if (action.action === 'delete') {
    if (!existing) {
      return { action: 'missing_deleted_user' as const, clerkUserId: action.clerkUserId }
    }
    await db
      .update(users)
      .set({ status: 'deleted', updatedAt: now })
      .where(eq(users.clerkUserId, action.clerkUserId))
    return { action: 'deleted' as const, userId: existing.id, clerkUserId: action.clerkUserId }
  }

  const platformRole = action.platformRole ?? existing?.platformRole ?? 'buyer'

  if (existing) {
    await db
      .update(users)
      .set({
        name: action.name,
        email: action.email,
        phone: action.phone,
        platformRole,
        status: action.status,
        updatedAt: now,
      })
      .where(eq(users.clerkUserId, action.clerkUserId))
    return { action: 'updated' as const, userId: existing.id, clerkUserId: action.clerkUserId }
  }

  const id = crypto.randomUUID()
  await db.insert(users).values({
    id,
    clerkUserId: action.clerkUserId,
    name: action.name,
    email: action.email,
    phone: action.phone,
    platformRole,
    status: action.status,
    createdAt: now,
    updatedAt: now,
  })
  return { action: 'created' as const, userId: id, clerkUserId: action.clerkUserId }
}
