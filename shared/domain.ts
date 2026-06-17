export const USER_ROLES = ['buyer', 'company_admin', 'staff', 'platform_admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const QUOTE_STATUSES = [
  'new',
  'viewed',
  'responded',
  'accepted',
  'declined',
  'expired',
  'converted',
] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const PROPOSAL_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
  'withdrawn',
] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const JOB_STATUSES = [
  'accepted',
  'scheduled',
  'in_progress',
  'awaiting_invoice',
  'invoiced',
  'paid',
  'closed',
  'cancelled',
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'overdue', 'paid', 'void'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const CHANGE_ORDER_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'withdrawn',
] as const
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number]

export const COMPANY_STATUSES = ['draft', 'pending', 'verified', 'rejected', 'suspended'] as const
export type CompanyStatus = (typeof COMPANY_STATUSES)[number]

export interface ApiErrorShape {
  error: {
    code: string
    message: string
    fields?: Record<string, string[]>
    requestId?: string
  }
}

export interface ApiSuccess<T> {
  data: T
  meta?: {
    cursor?: string | null
    hasMore?: boolean
    requestId?: string
  }
}

export interface CompanySummary {
  id: string
  name: string
  slug: string
  description: string
  categories: string[]
  city: string
  state: string
  serviceRadiusMiles: number
  rating: number
  reviewCount: number
  verified: boolean
  licenseNumber?: string | null
  imageUrl?: string | null
}

export interface DashboardMetric {
  label: string
  value: string
  hint: string
}

export interface ActivityItem {
  id: string
  title: string
  detail: string
  timestamp: string
  tone: 'neutral' | 'success' | 'warning'
}
