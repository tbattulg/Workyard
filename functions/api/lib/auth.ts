import { createClerkClient } from '@clerk/backend'
import { and, eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { companyMembers, jobAssignments, users } from '../../../shared/db/schema'
import type { UserRole } from '../../../shared/domain'
import { HttpError } from './http'
import type { Actor, AppBindings, AppEnv } from './types'

async function authenticateClerk(env: AppBindings, request: Request): Promise<string | null> {
  if (!env.CLERK_SECRET_KEY || !env.CLERK_PUBLISHABLE_KEY) {
    return null
  }

  const client = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  })
  const state = await client.authenticateRequest(request, {
    authorizedParties: [env.PUBLIC_APP_URL],
    jwtKey: env.CLERK_JWT_KEY,
  })
  if (!state.isAuthenticated) {
    return null
  }
  return state.toAuth().userId
}

export function isDemoAuthEnabled(env: Pick<AppBindings, 'ALLOW_DEMO_AUTH' | 'ENVIRONMENT'>) {
  return env.ALLOW_DEMO_AUTH === 'true' && env.ENVIRONMENT !== 'production'
}

export function getDemoClerkUserId(
  env: Pick<AppBindings, 'ALLOW_DEMO_AUTH' | 'ENVIRONMENT'>,
  request: Request,
) {
  if (!isDemoAuthEnabled(env)) {
    return null
  }
  return request.headers.get('x-demo-user') || 'demo_buyer'
}

export async function resolveActor(env: AppBindings, request: Request): Promise<Actor | null> {
  let clerkUserId = await authenticateClerk(env, request)
  if (!clerkUserId) {
    clerkUserId = getDemoClerkUserId(env, request)
  }
  if (!clerkUserId) {
    return null
  }

  const db = drizzle(env.DB)
  const [record] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1)
  if (!record) {
    return null
  }

  return {
    id: record.id,
    clerkUserId: record.clerkUserId,
    name: record.name,
    email: record.email,
    role: record.platformRole,
    status: record.status,
  }
}

export function requireActor(c: Context<AppEnv>): Actor {
  const actor = c.get('actor')
  if (!actor) {
    throw new HttpError(401, 'authentication_required', 'Sign in to continue.')
  }
  if (actor.status !== 'active') {
    throw new HttpError(403, 'account_unavailable', 'This account cannot perform that action.')
  }
  return actor
}

export function requirePlatformRole(c: Context<AppEnv>, roles: UserRole[]): Actor {
  const actor = requireActor(c)
  if (!roles.includes(actor.role)) {
    throw new HttpError(403, 'forbidden', 'You do not have permission to perform this action.')
  }
  return actor
}

export async function requireCompanyMember(
  c: Context<AppEnv>,
  companyId: string,
  allowedRoles: Array<'company_admin' | 'staff'> = ['company_admin', 'staff'],
) {
  const actor = requireActor(c)
  if (actor.role === 'platform_admin') {
    return { actor, companyRole: 'company_admin' as const }
  }
  const db = drizzle(c.env.DB)
  const [membership] = await db
    .select()
    .from(companyMembers)
    .where(
      and(
        eq(companyMembers.companyId, companyId),
        eq(companyMembers.userId, actor.id),
        eq(companyMembers.status, 'active'),
      ),
    )
    .limit(1)
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new HttpError(403, 'company_access_denied', 'You cannot access this company record.')
  }
  return { actor, companyRole: membership.role }
}

export async function requireQuoteCompanyAccess(
  c: Context<AppEnv>,
  companyId: string,
  assignedToUserId: string | null,
  allowedRoles: Array<'company_admin' | 'staff'> = ['company_admin', 'staff'],
) {
  const access = await requireCompanyMember(c, companyId, allowedRoles)
  if (access.companyRole === 'staff' && assignedToUserId !== access.actor.id) {
    throw new HttpError(
      403,
      'lead_assignment_required',
      'This lead is assigned to another team member.',
    )
  }
  return access
}

export async function requireJobCompanyAccess(
  c: Context<AppEnv>,
  companyId: string,
  jobId: string,
  allowedRoles: Array<'company_admin' | 'staff'> = ['company_admin', 'staff'],
) {
  const access = await requireCompanyMember(c, companyId, allowedRoles)
  if (access.companyRole === 'staff') {
    const db = drizzle(c.env.DB)
    const [assignment] = await db
      .select({ jobId: jobAssignments.jobId })
      .from(jobAssignments)
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.userId, access.actor.id)))
      .limit(1)
    if (!assignment) {
      throw new HttpError(
        403,
        'job_assignment_required',
        'This job is assigned to another team member.',
      )
    }
  }
  return access
}
