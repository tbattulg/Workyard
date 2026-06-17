import type { UserRole } from '../../../shared/domain'

export type AppBindings = Omit<Env, 'FILES'> & {
  FILES?: R2Bucket
  CLERK_SECRET_KEY?: string
  CLERK_PUBLISHABLE_KEY?: string
  CLERK_JWT_KEY?: string
  RESEND_API_KEY?: string
  MAPBOX_SECRET_TOKEN?: string
  SENTRY_DSN?: string
  TURNSTILE_SECRET_KEY?: string
}

export interface Actor {
  id: string
  clerkUserId: string
  name: string
  email: string
  role: UserRole
  status: 'active' | 'suspended' | 'deleted'
}

export interface AppVariables {
  requestId: string
  actor: Actor | null
}

export type AppEnv = {
  Bindings: AppBindings
  Variables: AppVariables
}
