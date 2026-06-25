import { and, desc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import {
  auditEvents,
  changeOrderItems,
  changeOrders,
  companies,
  companyMembers,
  companyServiceAreas,
  companyVerificationDocuments,
  emailDeliveries,
  favorites,
  files,
  idempotencyKeys,
  invoiceItems,
  invoicePayments,
  invoiceSequences,
  invoices,
  invoiceStatusHistory,
  jobAssignments,
  jobStatusHistory,
  jobs,
  messageThreads,
  messages,
  notifications,
  proposalItems,
  proposals,
  quoteRequests,
  reviews,
  serviceCategories,
  services,
  supportRequests,
  threadParticipants,
  users,
} from '../../shared/db/schema'
import type { CompanySummary } from '../../shared/domain'
import { calculateInvoiceTotals } from '../../shared/money'
import {
  companySearchSchema,
  cursorQuerySchema,
  invoiceSchema,
  jobStatusSchema,
  messageSchema,
  proposalSchema,
  quoteRequestSchema,
  reviewSchema,
  supportRequestSchema,
  uuidSchema,
} from '../../shared/validation'
import {
  canTransitionInvoice,
  canTransitionJob,
  canTransitionProposal,
} from '../../shared/transitions'
import { verifyWebhook } from '@clerk/backend/webhooks'
import {
  requireActor,
  requireCompanyMember,
  requireJobCompanyAccess,
  requirePlatformRole,
  requireQuoteCompanyAccess,
  resolveActor,
} from './lib/auth'
import { writeAudit } from './lib/audit'
import {
  applyClerkUserSyncAction,
  buildClerkUserSyncAction,
  ClerkUserSyncError,
  type ClerkUserSyncAction,
} from './lib/clerk-sync'
import { sendInvoiceEmail } from './lib/email'
import { canAccessFile, MAX_UPLOAD_BYTES, requireFileStorage, validateFile } from './lib/files'
import { handleError, HttpError, ok, validationFields } from './lib/http'
import { executeIdempotently } from './lib/idempotency'
import { createInvoicePdf } from './lib/pdf'
import type { AppEnv } from './lib/types'

export const app = new Hono<AppEnv>().basePath('/api/v1')

app.use('*', secureHeaders())
app.use('*', async (c, next) => {
  const requestId = c.req.header('cf-ray') || crypto.randomUUID()
  c.set('requestId', requestId)
  c.set('actor', await resolveActor(c.env, c.req.raw))
  const startedAt = Date.now()
  await next()
  console.log(
    JSON.stringify({
      message: 'request completed',
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
      actorId: c.get('actor')?.id ?? null,
    }),
  )
})

app.onError((error, c) => handleError(c, error))
app.notFound((c) =>
  c.json(
    { error: { code: 'not_found', message: 'Route not found.', requestId: c.get('requestId') } },
    404,
  ),
)

app.get('/health', (c) =>
  ok(c, { status: 'ok', environment: c.env.ENVIRONMENT, timestamp: new Date().toISOString() }),
)

app.post('/webhooks/clerk', async (c) => {
  if (!c.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    throw new HttpError(
      503,
      'clerk_webhook_not_configured',
      'Clerk webhook signing is not configured.',
    )
  }

  let event: Awaited<ReturnType<typeof verifyWebhook>>
  try {
    event = await verifyWebhook(c.req.raw, {
      signingSecret: c.env.CLERK_WEBHOOK_SIGNING_SECRET,
    })
  } catch {
    throw new HttpError(401, 'invalid_clerk_webhook', 'Clerk webhook verification failed.')
  }

  let action: ClerkUserSyncAction
  try {
    action = buildClerkUserSyncAction(event)
  } catch (error) {
    if (error instanceof ClerkUserSyncError) {
      throw new HttpError(422, error.code, error.message)
    }
    throw error
  }

  const result = await applyClerkUserSyncAction(c.env.DB, action)
  await writeAudit(c, {
    action: `clerk_user.${result.action}`,
    targetType: 'user',
    targetId: 'userId' in result ? result.userId : undefined,
    details: {
      clerkUserId: 'clerkUserId' in result ? (result.clerkUserId ?? null) : null,
      eventType: event.type,
    },
  })
  return ok(c, result)
})

const companyInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(40).max(5000),
  licenseNumber: z.string().trim().max(120).optional(),
  website: z.string().trim().url().max(500).optional(),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(254),
  addressLine1: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(80),
  state: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  zip: z.string().regex(/^\d{5}$/),
  serviceRadiusMiles: z.number().int().min(1).max(150).default(25),
})

const serviceInputSchema = z.object({
  companyId: uuidSchema,
  categoryId: uuidSchema,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(5000),
  pricingType: z.enum(['quote', 'starting_at', 'hourly']).default('quote'),
  startingPriceCents: z.number().int().nonnegative().optional(),
})

const quoteCreateSchema = quoteRequestSchema.extend({
  fileIds: z.array(uuidSchema).max(10).default([]),
})

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
}

app.get('/companies', async (c) => {
  const parsed = companySearchSchema.safeParse(c.req.query())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_query',
      'Review the search filters.',
      validationFields(parsed.error),
    )
  const { q, category, city, zip, limit } = parsed.data
  const db = drizzle(c.env.DB)
  const conditions = [eq(companies.status, 'verified'), isNull(companies.deletedAt)]
  if (city) {
    const cityCondition = or(like(companies.city, city), like(companyServiceAreas.city, city))
    if (cityCondition) conditions.push(cityCondition)
  }
  if (zip) {
    const zipCondition = or(eq(companies.zip, zip), eq(companyServiceAreas.zip, zip))
    if (zipCondition) conditions.push(zipCondition)
  }
  if (category)
    conditions.push(eq(serviceCategories.slug, category.toLowerCase().replaceAll(' ', '-')))
  if (q) {
    const term = `%${q.replaceAll('%', '')}%`
    const searchCondition = or(
      like(companies.name, term),
      like(companies.description, term),
      like(services.title, term),
    )
    if (searchCondition) conditions.push(searchCondition)
  }
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      description: companies.description,
      city: companies.city,
      state: companies.state,
      serviceRadiusMiles: companies.serviceRadiusMiles,
      licenseNumber: companies.licenseNumber,
      category: serviceCategories.name,
      rating: sql<number>`coalesce(avg(${reviews.rating}), 0)`,
      reviewCount: sql<number>`count(distinct ${reviews.id})`,
    })
    .from(companies)
    .leftJoin(companyServiceAreas, eq(companyServiceAreas.companyId, companies.id))
    .leftJoin(services, and(eq(services.companyId, companies.id), eq(services.active, true)))
    .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .leftJoin(reviews, and(eq(reviews.companyId, companies.id), eq(reviews.status, 'published')))
    .where(and(...conditions))
    .groupBy(companies.id, serviceCategories.name)
    .orderBy(desc(sql`avg(${reviews.rating})`), companies.name)
    .limit(limit * 8)

  const byCompany = new Map<string, CompanySummary>()
  for (const row of rows) {
    const existing = byCompany.get(row.id)
    if (existing) {
      if (row.category && !existing.categories.includes(row.category))
        existing.categories.push(row.category)
      continue
    }
    byCompany.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      city: row.city,
      state: row.state,
      serviceRadiusMiles: row.serviceRadiusMiles,
      licenseNumber: row.licenseNumber,
      categories: row.category ? [row.category] : [],
      rating: Number(row.rating),
      reviewCount: Number(row.reviewCount),
      verified: true,
      imageUrl: null,
    })
  }
  const data = [...byCompany.values()].slice(0, limit)
  return ok(c, data, { cursor: null, hasMore: false })
})

app.get('/companies/:slug', async (c) => {
  const db = drizzle(c.env.DB)
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.slug, c.req.param('slug')),
        eq(companies.status, 'verified'),
        isNull(companies.deletedAt),
      ),
    )
    .limit(1)
  if (!company) throw new HttpError(404, 'company_not_found', 'Company not found.')
  const companyServices = await db
    .select({
      id: services.id,
      title: services.title,
      slug: services.slug,
      description: services.description,
      pricingType: services.pricingType,
      startingPriceCents: services.startingPriceCents,
      category: serviceCategories.name,
    })
    .from(services)
    .innerJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .where(and(eq(services.companyId, company.id), eq(services.active, true)))
  const companyReviews = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.companyId, company.id), eq(reviews.status, 'published')))
    .orderBy(desc(reviews.createdAt))
    .limit(20)
  return ok(c, { ...company, services: companyServices, reviews: companyReviews })
})

app.get('/services', async (c) => {
  const parsed = cursorQuerySchema.safeParse(c.req.query())
  if (!parsed.success)
    throw new HttpError(422, 'invalid_query', 'Invalid pagination.', validationFields(parsed.error))
  const db = drizzle(c.env.DB)
  const data = await db
    .select({
      id: services.id,
      title: services.title,
      slug: services.slug,
      description: services.description,
      companyId: services.companyId,
      companyName: companies.name,
      category: serviceCategories.name,
    })
    .from(services)
    .innerJoin(companies, eq(companies.id, services.companyId))
    .innerJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .where(and(eq(services.active, true), eq(companies.status, 'verified')))
    .limit(parsed.data.limit)
  return ok(c, data, { cursor: null, hasMore: false })
})

app.get('/me', async (c) => {
  const actor = requireActor(c)
  const db = drizzle(c.env.DB)
  const memberships = await db
    .select({
      companyId: companyMembers.companyId,
      companyName: companies.name,
      role: companyMembers.role,
      companyStatus: companies.status,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(and(eq(companyMembers.userId, actor.id), eq(companyMembers.status, 'active')))
  return ok(c, { ...actor, memberships })
})

app.post('/companies', async (c) => {
  const actor = requireActor(c)
  const parsed = companyInputSchema.safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_company',
      'Review the company profile.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const now = new Date().toISOString()
  const companyId = crypto.randomUUID()
  const slug = `${slugify(parsed.data.name)}-${companyId.slice(0, 8)}`
  await db.batch([
    db.insert(companies).values({
      id: companyId,
      slug,
      ...parsed.data,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(companyMembers).values({
      companyId,
      userId: actor.id,
      role: 'company_admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(companyServiceAreas).values({
      id: crypto.randomUUID(),
      companyId,
      city: parsed.data.city,
      state: parsed.data.state,
      zip: parsed.data.zip,
      radiusMiles: parsed.data.serviceRadiusMiles,
      createdAt: now,
    }),
  ])
  await writeAudit(c, {
    action: 'company.created',
    targetType: 'company',
    targetId: companyId,
    companyId,
  })
  return c.json(
    { data: { id: companyId, slug, status: 'draft' }, meta: { requestId: c.get('requestId') } },
    201,
  )
})

app.patch('/companies/:id', async (c) => {
  const companyId = uuidSchema.parse(c.req.param('id'))
  const { actor } = await requireCompanyMember(c, companyId, ['company_admin'])
  const parsed = companyInputSchema.partial().safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_company',
      'Review the company profile.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company) throw new HttpError(404, 'company_not_found', 'Company not found.')
  const now = new Date().toISOString()
  const status = company.status === 'verified' ? 'pending' : company.status
  await db
    .update(companies)
    .set({ ...parsed.data, status, updatedAt: now })
    .where(eq(companies.id, companyId))
  await writeAudit(c, {
    action: 'company.updated',
    targetType: 'company',
    targetId: companyId,
    companyId,
    details: { actorId: actor.id, requiresReview: company.status === 'verified' },
  })
  return ok(c, { id: companyId, status })
})

app.post('/companies/:id/verification-documents', async (c) => {
  const companyId = uuidSchema.parse(c.req.param('id'))
  const { actor } = await requireCompanyMember(c, companyId, ['company_admin'])
  const parsed = z
    .object({
      fileId: uuidSchema,
      type: z.enum(['business_registration', 'license', 'insurance']),
      expiresAt: z.string().date().optional(),
    })
    .safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_verification_document',
      'Review the verification document.',
      validationFields(parsed.error),
    )
  const file = await canAccessFile(c, actor, parsed.data.fileId)
  const db = drizzle(c.env.DB)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.batch([
    db.insert(companyVerificationDocuments).values({
      id,
      companyId,
      type: parsed.data.type,
      fileId: file.id,
      expiresAt: parsed.data.expiresAt,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }),
    db.update(files).set({ companyId }).where(eq(files.id, file.id)),
  ])
  await writeAudit(c, {
    action: 'company.verification_document_added',
    targetType: 'company',
    targetId: companyId,
    companyId,
  })
  return c.json({ data: { id, status: 'pending' }, meta: { requestId: c.get('requestId') } }, 201)
})

app.post('/companies/:id/submit-verification', async (c) => {
  const companyId = uuidSchema.parse(c.req.param('id'))
  await requireCompanyMember(c, companyId, ['company_admin'])
  const db = drizzle(c.env.DB)
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company) throw new HttpError(404, 'company_not_found', 'Company not found.')
  const [document] = await db
    .select({ id: companyVerificationDocuments.id })
    .from(companyVerificationDocuments)
    .where(eq(companyVerificationDocuments.companyId, companyId))
    .limit(1)
  if (!document || !company.licenseNumber)
    throw new HttpError(
      409,
      'verification_incomplete',
      'Add a license number and at least one verification document.',
    )
  const now = new Date().toISOString()
  await db
    .update(companies)
    .set({ status: 'pending', updatedAt: now })
    .where(eq(companies.id, companyId))
  await writeAudit(c, {
    action: 'company.verification_submitted',
    targetType: 'company',
    targetId: companyId,
    companyId,
  })
  return ok(c, { id: companyId, status: 'pending' })
})

app.post('/services', async (c) => {
  const parsed = serviceInputSchema.safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_service',
      'Review the service listing.',
      validationFields(parsed.error),
    )
  await requireCompanyMember(c, parsed.data.companyId, ['company_admin'])
  const db = drizzle(c.env.DB)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.insert(services).values({
    id,
    ...parsed.data,
    slug: `${slugify(parsed.data.title)}-${id.slice(0, 8)}`,
    active: false,
    createdAt: now,
    updatedAt: now,
  })
  await writeAudit(c, {
    action: 'service.created',
    targetType: 'service',
    targetId: id,
    companyId: parsed.data.companyId,
  })
  return c.json({ data: { id, active: false }, meta: { requestId: c.get('requestId') } }, 201)
})

app.patch('/services/:id', async (c) => {
  const serviceId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1)
  if (!service) throw new HttpError(404, 'service_not_found', 'Service not found.')
  await requireCompanyMember(c, service.companyId, ['company_admin'])
  const parsed = serviceInputSchema
    .omit({ companyId: true })
    .partial()
    .safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_service',
      'Review the service listing.',
      validationFields(parsed.error),
    )
  await db
    .update(services)
    .set({ ...parsed.data, active: false, updatedAt: new Date().toISOString() })
    .where(eq(services.id, serviceId))
  await writeAudit(c, {
    action: 'service.updated',
    targetType: 'service',
    targetId: serviceId,
    companyId: service.companyId,
  })
  return ok(c, { id: serviceId, active: false })
})

app.post('/companies/:id/favorite', async (c) => {
  const actor = requireActor(c)
  const companyId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  await db
    .insert(favorites)
    .values({ buyerId: actor.id, companyId, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
  return ok(c, { companyId, favorite: true })
})

app.delete('/companies/:id/favorite', async (c) => {
  const actor = requireActor(c)
  const companyId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  await db
    .delete(favorites)
    .where(and(eq(favorites.buyerId, actor.id), eq(favorites.companyId, companyId)))
  return ok(c, { companyId, favorite: false })
})

app.post('/quotes', async (c) => {
  const actor = requireActor(c)
  const raw = await c.req.text()
  const parsed = quoteCreateSchema.safeParse(JSON.parse(raw || '{}'))
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_quote',
      'Review the project request.',
      validationFields(parsed.error),
    )
  const result = await executeIdempotently(c, actor, 'quote.create', raw, async () => {
    const db = drizzle(c.env.DB)
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, parsed.data.companyId), eq(companies.status, 'verified')))
      .limit(1)
    if (!company)
      throw new HttpError(404, 'company_not_found', 'This company is not accepting requests.')
    if (parsed.data.serviceId) {
      const [service] = await db
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            eq(services.id, parsed.data.serviceId),
            eq(services.companyId, company.id),
            eq(services.active, true),
          ),
        )
        .limit(1)
      if (!service)
        throw new HttpError(404, 'service_not_found', 'This service is not accepting requests.')
    }
    const companyAdmins = await db
      .select({ userId: companyMembers.userId })
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.companyId, company.id),
          eq(companyMembers.role, 'company_admin'),
          eq(companyMembers.status, 'active'),
        ),
      )
    const attachedFiles = parsed.data.fileIds.length
      ? await db
          .select({ id: files.id })
          .from(files)
          .where(
            and(
              inArray(files.id, parsed.data.fileIds),
              eq(files.ownerUserId, actor.id),
              isNull(files.quoteRequestId),
              isNull(files.jobId),
              isNull(files.deletedAt),
              eq(files.scanStatus, 'clean'),
            ),
          )
      : []
    if (attachedFiles.length !== parsed.data.fileIds.length)
      throw new HttpError(
        422,
        'invalid_file_attachment',
        'One or more files cannot be attached to this request.',
      )
    const now = new Date().toISOString()
    const quoteId = crypto.randomUUID()
    const threadId = crypto.randomUUID()
    const quoteInput = quoteRequestSchema.parse(parsed.data)
    await db.batch([
      db.insert(quoteRequests).values({
        id: quoteId,
        buyerId: actor.id,
        ...quoteInput,
        status: 'new',
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(messageThreads).values({
        id: threadId,
        quoteRequestId: quoteId,
        companyId: company.id,
        buyerId: actor.id,
        subject: parsed.data.jobDescription.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(threadParticipants).values({ threadId, userId: actor.id, createdAt: now }),
      db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: actor.id,
        type: 'quote_created',
        title: 'Quote request sent',
        body: 'Your project request is now in the company lead inbox.',
        payloadJson: JSON.stringify({ quoteId }),
        createdAt: now,
      }),
    ])
    if (attachedFiles.length > 0) {
      await db
        .update(files)
        .set({
          quoteRequestId: quoteId,
          companyId: company.id,
          visibility: 'job_participants',
        })
        .where(
          inArray(
            files.id,
            attachedFiles.map((file) => file.id),
          ),
        )
    }
    if (companyAdmins.length > 0) {
      await db
        .insert(threadParticipants)
        .values(
          companyAdmins.map((member) => ({ threadId, userId: member.userId, createdAt: now })),
        )
      await db.insert(notifications).values(
        companyAdmins.map((member) => ({
          id: crypto.randomUUID(),
          userId: member.userId,
          type: 'quote_received',
          title: 'New quote request',
          body: `${parsed.data.name} submitted a new project request.`,
          payloadJson: JSON.stringify({ quoteId }),
          createdAt: now,
        })),
      )
    }
    await writeAudit(c, {
      action: 'quote.created',
      targetType: 'quote_request',
      targetId: quoteId,
      companyId: company.id,
    })
    return { id: quoteId, threadId, status: 'new' as const }
  })
  return c.json(
    { data: result.value, meta: { replayed: result.replayed, requestId: c.get('requestId') } },
    201,
  )
})

app.get('/quotes', async (c) => {
  const actor = requireActor(c)
  const db = drizzle(c.env.DB)
  const scope = c.req.query('scope') ?? 'company'
  if (scope === 'buyer') {
    return ok(
      c,
      await db
        .select()
        .from(quoteRequests)
        .where(eq(quoteRequests.buyerId, actor.id))
        .orderBy(desc(quoteRequests.createdAt))
        .limit(50),
    )
  }
  const memberships = await db
    .select({ companyId: companyMembers.companyId, role: companyMembers.role })
    .from(companyMembers)
    .where(and(eq(companyMembers.userId, actor.id), eq(companyMembers.status, 'active')))
  if (memberships.length === 0 && actor.role !== 'platform_admin') return ok(c, [])
  const companyIds = memberships.map((item) => item.companyId)
  const isStaffOnly = memberships.length > 0 && memberships.every((item) => item.role === 'staff')
  const condition =
    actor.role === 'platform_admin'
      ? undefined
      : and(
          inArray(quoteRequests.companyId, companyIds),
          isStaffOnly ? eq(quoteRequests.assignedToUserId, actor.id) : undefined,
        )
  return ok(
    c,
    await db
      .select()
      .from(quoteRequests)
      .where(condition)
      .orderBy(desc(quoteRequests.createdAt))
      .limit(100),
  )
})

app.post('/quotes/:id/assign', async (c) => {
  const quoteId = uuidSchema.parse(c.req.param('id'))
  const parsed = z.object({ userId: uuidSchema }).safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_assignment',
      'Select a valid team member.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, quoteId))
    .limit(1)
  if (!quote) throw new HttpError(404, 'quote_not_found', 'Quote request not found.')
  const { actor } = await requireCompanyMember(c, quote.companyId, ['company_admin'])
  const [member] = await db
    .select({ userId: companyMembers.userId })
    .from(companyMembers)
    .where(
      and(
        eq(companyMembers.companyId, quote.companyId),
        eq(companyMembers.userId, parsed.data.userId),
        eq(companyMembers.status, 'active'),
      ),
    )
    .limit(1)
  if (!member)
    throw new HttpError(409, 'invalid_assignment', 'That user is not an active company member.')
  const [thread] = await db
    .select({ id: messageThreads.id })
    .from(messageThreads)
    .where(eq(messageThreads.quoteRequestId, quote.id))
    .limit(1)
  await db
    .update(quoteRequests)
    .set({ assignedToUserId: member.userId, updatedAt: new Date().toISOString() })
    .where(eq(quoteRequests.id, quote.id))
  if (thread) {
    await db
      .insert(threadParticipants)
      .values({ threadId: thread.id, userId: member.userId, createdAt: new Date().toISOString() })
      .onConflictDoNothing()
  }
  await writeAudit(c, {
    action: 'quote.assigned',
    targetType: 'quote_request',
    targetId: quote.id,
    companyId: quote.companyId,
    details: { assignedToUserId: member.userId, assignedBy: actor.id },
  })
  return ok(c, { id: quote.id, assignedToUserId: member.userId })
})

app.post('/proposals', async (c) => {
  const raw = await c.req.text()
  const parsed = proposalSchema.safeParse(JSON.parse(raw || '{}'))
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_proposal',
      'Review the proposal.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, parsed.data.quoteRequestId))
    .limit(1)
  if (!quote) throw new HttpError(404, 'quote_not_found', 'Quote request not found.')
  const { actor } = await requireQuoteCompanyAccess(c, quote.companyId, quote.assignedToUserId, [
    'company_admin',
    'staff',
  ])
  const result = await executeIdempotently(c, actor, 'proposal.create', raw, async () => {
    const proposalId = crypto.randomUUID()
    const now = new Date().toISOString()
    const itemValues = parsed.data.items.map((item, index) => ({
      id: crypto.randomUUID(),
      proposalId,
      ...item,
      lineTotalCents: Math.round((item.quantityMilli * item.unitPriceCents) / 1000),
      sortOrder: index,
    }))
    const subtotalCents = itemValues.reduce((sum, item) => sum + item.lineTotalCents, 0)
    await db.batch([
      db.insert(proposals).values({
        id: proposalId,
        quoteRequestId: quote.id,
        companyId: quote.companyId,
        createdBy: actor.id,
        title: parsed.data.title,
        summary: parsed.data.summary,
        validUntil: parsed.data.validUntil,
        subtotalCents,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(proposalItems).values(itemValues),
    ])
    await writeAudit(c, {
      action: 'proposal.created',
      targetType: 'proposal',
      targetId: proposalId,
      companyId: quote.companyId,
    })
    return { id: proposalId, subtotalCents, status: 'draft' as const }
  })
  return c.json(
    { data: result.value, meta: { replayed: result.replayed, requestId: c.get('requestId') } },
    201,
  )
})

app.post('/proposals/:id/send', async (c) => {
  const proposalId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1)
  if (!proposal) throw new HttpError(404, 'proposal_not_found', 'Proposal not found.')
  const { actor } = await requireCompanyMember(c, proposal.companyId, ['company_admin'])
  if (!canTransitionProposal(proposal.status, 'sent'))
    throw new HttpError(409, 'invalid_transition', 'Only draft proposals can be sent.')
  const raw = await c.req.text()
  const result = await executeIdempotently(c, actor, 'proposal.send', raw || '{}', async () => {
    const now = new Date().toISOString()
    await db.batch([
      db
        .update(proposals)
        .set({ status: 'sent', sentAt: now, updatedAt: now })
        .where(eq(proposals.id, proposal.id)),
      db
        .update(quoteRequests)
        .set({ status: 'responded', updatedAt: now })
        .where(eq(quoteRequests.id, proposal.quoteRequestId)),
    ])
    await writeAudit(c, {
      action: 'proposal.sent',
      targetType: 'proposal',
      targetId: proposal.id,
      companyId: proposal.companyId,
    })
    return { id: proposal.id, status: 'sent' as const }
  })
  return ok(c, result.value)
})

app.post('/proposals/:id/accept', async (c) => {
  const actor = requireActor(c)
  const proposalId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1)
  if (!proposal) throw new HttpError(404, 'proposal_not_found', 'Proposal not found.')
  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(and(eq(quoteRequests.id, proposal.quoteRequestId), eq(quoteRequests.buyerId, actor.id)))
    .limit(1)
  if (!quote) throw new HttpError(403, 'proposal_access_denied', 'You cannot accept this proposal.')
  if (!canTransitionProposal(proposal.status, 'accepted'))
    throw new HttpError(409, 'invalid_transition', 'This proposal can no longer be accepted.')
  const [thread] = await db
    .select()
    .from(messageThreads)
    .where(eq(messageThreads.quoteRequestId, quote.id))
    .limit(1)
  if (!thread)
    throw new HttpError(500, 'thread_missing', 'The project conversation could not be found.')
  const now = new Date().toISOString()
  const jobId = crypto.randomUUID()
  await db.batch([
    db
      .update(proposals)
      .set({ status: 'accepted', respondedAt: now, updatedAt: now })
      .where(eq(proposals.id, proposal.id)),
    db
      .update(quoteRequests)
      .set({ status: 'converted', updatedAt: now })
      .where(eq(quoteRequests.id, quote.id)),
    db.insert(jobs).values({
      id: jobId,
      quoteRequestId: quote.id,
      acceptedProposalId: proposal.id,
      buyerId: actor.id,
      companyId: quote.companyId,
      threadId: thread.id,
      title: proposal.title,
      scopeSummary: proposal.summary,
      siteAddress: `${quote.projectAddress}, ${quote.projectCity}, ${quote.projectState} ${quote.projectZip}`,
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(jobStatusHistory).values({
      id: crypto.randomUUID(),
      jobId,
      oldStatus: null,
      newStatus: 'accepted',
      changedBy: actor.id,
      createdAt: now,
    }),
    db.insert(jobAssignments).values({
      jobId,
      userId: proposal.createdBy,
      assignedBy: proposal.createdBy,
      createdAt: now,
    }),
    db
      .update(messageThreads)
      .set({ jobId, updatedAt: now })
      .where(eq(messageThreads.id, thread.id)),
  ])
  await writeAudit(c, {
    action: 'proposal.accepted',
    targetType: 'proposal',
    targetId: proposal.id,
    companyId: quote.companyId,
    details: { jobId },
  })
  return c.json(
    { data: { jobId, status: 'accepted' }, meta: { requestId: c.get('requestId') } },
    201,
  )
})

app.get('/threads', async (c) => {
  const actor = requireActor(c)
  const db = drizzle(c.env.DB)
  const rows = await db
    .select({
      id: messageThreads.id,
      subject: messageThreads.subject,
      quoteRequestId: messageThreads.quoteRequestId,
      jobId: messageThreads.jobId,
      lastMessageAt: messageThreads.lastMessageAt,
    })
    .from(threadParticipants)
    .innerJoin(messageThreads, eq(messageThreads.id, threadParticipants.threadId))
    .where(eq(threadParticipants.userId, actor.id))
    .orderBy(desc(messageThreads.lastMessageAt))
    .limit(50)
  return ok(c, rows)
})

app.post('/threads/:id/messages', async (c) => {
  const actor = requireActor(c)
  const threadId = uuidSchema.parse(c.req.param('id'))
  const parsed = messageSchema.safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_message',
      'Review the message.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [participant] = await db
    .select()
    .from(threadParticipants)
    .where(and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, actor.id)))
    .limit(1)
  if (!participant && actor.role !== 'platform_admin')
    throw new HttpError(403, 'thread_access_denied', 'You cannot post in this conversation.')
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.batch([
    db
      .insert(messages)
      .values({ id, threadId, senderId: actor.id, body: parsed.data.body, createdAt: now }),
    db
      .update(messageThreads)
      .set({ lastMessageAt: now, updatedAt: now })
      .where(eq(messageThreads.id, threadId)),
  ])
  return c.json({ data: { id, createdAt: now }, meta: { requestId: c.get('requestId') } }, 201)
})

app.get('/jobs', async (c) => {
  const actor = requireActor(c)
  const db = drizzle(c.env.DB)
  const scope = c.req.query('scope') ?? 'company'
  if (scope === 'buyer')
    return ok(
      c,
      await db
        .select()
        .from(jobs)
        .where(eq(jobs.buyerId, actor.id))
        .orderBy(desc(jobs.updatedAt))
        .limit(50),
    )
  const memberships = await db
    .select({ companyId: companyMembers.companyId, role: companyMembers.role })
    .from(companyMembers)
    .where(and(eq(companyMembers.userId, actor.id), eq(companyMembers.status, 'active')))
  if (actor.role !== 'platform_admin' && memberships.length === 0) return ok(c, [])
  const isStaffOnly = memberships.length > 0 && memberships.every((item) => item.role === 'staff')
  return ok(
    c,
    await db
      .select()
      .from(jobs)
      .where(
        actor.role === 'platform_admin'
          ? undefined
          : and(
              inArray(
                jobs.companyId,
                memberships.map((item) => item.companyId),
              ),
              isStaffOnly
                ? inArray(
                    jobs.id,
                    db
                      .select({ jobId: jobAssignments.jobId })
                      .from(jobAssignments)
                      .where(eq(jobAssignments.userId, actor.id)),
                  )
                : undefined,
            ),
      )
      .orderBy(desc(jobs.updatedAt))
      .limit(100),
  )
})

app.patch('/jobs/:id/status', async (c) => {
  const jobId = uuidSchema.parse(c.req.param('id'))
  const parsed = jobStatusSchema.safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_status',
      'Review the job status.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
  if (!job) throw new HttpError(404, 'job_not_found', 'Job not found.')
  const { actor } = await requireJobCompanyAccess(c, job.companyId, job.id)
  if (!canTransitionJob(job.status, parsed.data.status))
    throw new HttpError(
      409,
      'invalid_transition',
      `Cannot move a job from ${job.status} to ${parsed.data.status}.`,
    )
  const now = new Date().toISOString()
  const completionDate =
    parsed.data.status === 'awaiting_invoice' ? now.slice(0, 10) : job.completionDate
  await db.batch([
    db
      .update(jobs)
      .set({ status: parsed.data.status, completionDate, updatedAt: now })
      .where(eq(jobs.id, job.id)),
    db.insert(jobStatusHistory).values({
      id: crypto.randomUUID(),
      jobId: job.id,
      oldStatus: job.status,
      newStatus: parsed.data.status,
      changedBy: actor.id,
      note: parsed.data.note,
      createdAt: now,
    }),
  ])
  await writeAudit(c, {
    action: 'job.status_changed',
    targetType: 'job',
    targetId: job.id,
    companyId: job.companyId,
    details: { from: job.status, to: parsed.data.status },
  })
  return ok(c, { id: job.id, status: parsed.data.status })
})

app.post('/jobs/:id/assign', async (c) => {
  const jobId = uuidSchema.parse(c.req.param('id'))
  const parsed = z.object({ userId: uuidSchema }).safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_assignment',
      'Select a valid team member.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
  if (!job) throw new HttpError(404, 'job_not_found', 'Job not found.')
  const { actor } = await requireCompanyMember(c, job.companyId, ['company_admin'])
  const [member] = await db
    .select({ userId: companyMembers.userId })
    .from(companyMembers)
    .where(
      and(
        eq(companyMembers.companyId, job.companyId),
        eq(companyMembers.userId, parsed.data.userId),
        eq(companyMembers.status, 'active'),
      ),
    )
    .limit(1)
  if (!member)
    throw new HttpError(409, 'invalid_assignment', 'That user is not an active company member.')
  await db
    .insert(jobAssignments)
    .values({
      jobId,
      userId: member.userId,
      assignedBy: actor.id,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
  await db
    .insert(threadParticipants)
    .values({ threadId: job.threadId, userId: member.userId, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
  await writeAudit(c, {
    action: 'job.assigned',
    targetType: 'job',
    targetId: job.id,
    companyId: job.companyId,
    details: { assignedToUserId: member.userId, assignedBy: actor.id },
  })
  return ok(c, { id: job.id, assignedToUserId: member.userId })
})

const changeOrderSchema = z.object({
  jobId: uuidSchema,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(2).max(500),
        quantityMilli: z.number().int().positive(),
        unitPriceCents: z.number().int().nonnegative(),
        itemType: z.enum(['labor', 'material', 'equipment', 'fee']),
      }),
    )
    .min(1)
    .max(100),
})
app.post('/change-orders', async (c) => {
  const parsed = changeOrderSchema.safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_change_order',
      'Review the change order.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [job] = await db.select().from(jobs).where(eq(jobs.id, parsed.data.jobId)).limit(1)
  if (!job) throw new HttpError(404, 'job_not_found', 'Job not found.')
  const { actor } = await requireJobCompanyAccess(c, job.companyId, job.id)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const items = parsed.data.items.map((item) => ({
    id: crypto.randomUUID(),
    changeOrderId: id,
    ...item,
    lineTotalCents: Math.round((item.quantityMilli * item.unitPriceCents) / 1000),
  }))
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0)
  await db.batch([
    db.insert(changeOrders).values({
      id,
      jobId: job.id,
      companyId: job.companyId,
      createdBy: actor.id,
      title: parsed.data.title,
      description: parsed.data.description,
      subtotalCents,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(changeOrderItems).values(items),
  ])
  await writeAudit(c, {
    action: 'change_order.created',
    targetType: 'change_order',
    targetId: id,
    companyId: job.companyId,
  })
  return c.json(
    { data: { id, subtotalCents, status: 'draft' }, meta: { requestId: c.get('requestId') } },
    201,
  )
})

app.post('/change-orders/:id/send', async (c) => {
  const id = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const [changeOrder] = await db.select().from(changeOrders).where(eq(changeOrders.id, id)).limit(1)
  if (!changeOrder) throw new HttpError(404, 'change_order_not_found', 'Change order not found.')
  const { actor } = await requireJobCompanyAccess(c, changeOrder.companyId, changeOrder.jobId)
  if (changeOrder.status !== 'draft')
    throw new HttpError(409, 'invalid_transition', 'Only draft change orders can be sent.')
  const now = new Date().toISOString()
  await db
    .update(changeOrders)
    .set({ status: 'submitted', submittedAt: now, updatedAt: now })
    .where(eq(changeOrders.id, id))
  await writeAudit(c, {
    action: 'change_order.submitted',
    targetType: 'change_order',
    targetId: id,
    companyId: changeOrder.companyId,
    details: { actorId: actor.id },
  })
  return ok(c, { id, status: 'submitted' })
})

app.post('/change-orders/:id/respond', async (c) => {
  const actor = requireActor(c)
  const id = uuidSchema.parse(c.req.param('id'))
  const parsed = z
    .object({ status: z.enum(['approved', 'rejected']) })
    .safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_response',
      'Select approved or rejected.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [changeOrder] = await db.select().from(changeOrders).where(eq(changeOrders.id, id)).limit(1)
  if (!changeOrder) throw new HttpError(404, 'change_order_not_found', 'Change order not found.')
  const [job] = await db
    .select({ buyerId: jobs.buyerId })
    .from(jobs)
    .where(eq(jobs.id, changeOrder.jobId))
    .limit(1)
  if (!job || job.buyerId !== actor.id)
    throw new HttpError(
      403,
      'change_order_access_denied',
      'You cannot respond to this change order.',
    )
  if (changeOrder.status !== 'submitted')
    throw new HttpError(409, 'invalid_transition', 'This change order is not awaiting a response.')
  const now = new Date().toISOString()
  await db
    .update(changeOrders)
    .set({ status: parsed.data.status, respondedAt: now, respondedBy: actor.id, updatedAt: now })
    .where(eq(changeOrders.id, id))
  await writeAudit(c, {
    action: `change_order.${parsed.data.status}`,
    targetType: 'change_order',
    targetId: id,
    companyId: changeOrder.companyId,
  })
  return ok(c, { id, status: parsed.data.status })
})

app.get('/invoices', async (c) => {
  const actor = requireActor(c)
  const db = drizzle(c.env.DB)
  const scope = c.req.query('scope') ?? 'company'
  if (scope === 'buyer')
    return ok(
      c,
      await db
        .select()
        .from(invoices)
        .where(eq(invoices.buyerId, actor.id))
        .orderBy(desc(invoices.createdAt))
        .limit(50),
    )
  const memberships = await db
    .select({ companyId: companyMembers.companyId, role: companyMembers.role })
    .from(companyMembers)
    .where(and(eq(companyMembers.userId, actor.id), eq(companyMembers.status, 'active')))
  if (actor.role !== 'platform_admin' && memberships.length === 0) return ok(c, [])
  const isStaffOnly = memberships.length > 0 && memberships.every((item) => item.role === 'staff')
  return ok(
    c,
    await db
      .select()
      .from(invoices)
      .where(
        actor.role === 'platform_admin'
          ? undefined
          : and(
              inArray(
                invoices.companyId,
                memberships.map((item) => item.companyId),
              ),
              isStaffOnly
                ? inArray(
                    invoices.jobId,
                    db
                      .select({ jobId: jobAssignments.jobId })
                      .from(jobAssignments)
                      .where(eq(jobAssignments.userId, actor.id)),
                  )
                : undefined,
            ),
      )
      .orderBy(desc(invoices.createdAt))
      .limit(100),
  )
})

app.get('/invoices/:id', async (c) => {
  const actor = requireActor(c)
  const invoiceId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  if (!invoice) throw new HttpError(404, 'invoice_not_found', 'Invoice not found.')
  if (invoice.buyerId === actor.id) {
    if (invoice.status === 'draft')
      throw new HttpError(404, 'invoice_not_found', 'Invoice not found.')
  } else {
    await requireJobCompanyAccess(c, invoice.companyId, invoice.jobId)
  }
  const [items, payments, attachments] = await Promise.all([
    db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id))
      .orderBy(invoiceItems.sortOrder),
    db
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoice.id))
      .orderBy(desc(invoicePayments.paidAt)),
    db
      .select({ id: files.id, name: files.originalName, mimeType: files.mimeType })
      .from(files)
      .where(and(eq(files.invoiceId, invoice.id), isNull(files.deletedAt))),
  ])
  if (invoice.buyerId === actor.id && invoice.status === 'sent') {
    const now = new Date().toISOString()
    await db.batch([
      db
        .update(invoices)
        .set({ status: 'viewed', viewedAt: now, updatedAt: now })
        .where(and(eq(invoices.id, invoice.id), eq(invoices.status, 'sent'))),
      db.insert(invoiceStatusHistory).values({
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        oldStatus: 'sent',
        newStatus: 'viewed',
        changedBy: actor.id,
        createdAt: now,
      }),
    ])
    invoice.status = 'viewed'
    invoice.viewedAt = now
  }
  return ok(c, { ...invoice, items, payments, attachments })
})

app.post('/invoices', async (c) => {
  const raw = await c.req.text()
  const parsed = invoiceSchema.safeParse(JSON.parse(raw || '{}'))
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_invoice',
      'Review the invoice.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [job] = await db.select().from(jobs).where(eq(jobs.id, parsed.data.jobId)).limit(1)
  if (!job) throw new HttpError(404, 'job_not_found', 'Job not found.')
  const { actor, companyRole } = await requireJobCompanyAccess(c, job.companyId, job.id)
  const result = await executeIdempotently(c, actor, 'invoice.create', raw, async () => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const totals = calculateInvoiceTotals(parsed.data)
    const invoiceYear = new Date().getUTCFullYear()
    const [sequence] = await db
      .insert(invoiceSequences)
      .values({ companyId: job.companyId, year: invoiceYear, nextNumber: 1 })
      .onConflictDoUpdate({
        target: [invoiceSequences.companyId, invoiceSequences.year],
        set: { nextNumber: sql`${invoiceSequences.nextNumber} + 1` },
      })
      .returning({ nextNumber: invoiceSequences.nextNumber })
    if (!sequence)
      throw new HttpError(500, 'invoice_number_failed', 'The invoice number could not be reserved.')
    const invoiceNumber = `INV-${invoiceYear}-${String(sequence.nextNumber).padStart(5, '0')}`
    const items = parsed.data.items.map((item, index) => ({
      id: crypto.randomUUID(),
      invoiceId: id,
      ...item,
      lineTotalCents: Math.round((item.quantityMilli * item.unitPriceCents) / 1000),
      sortOrder: index,
    }))
    await db.batch([
      db.insert(invoices).values({
        id,
        rootInvoiceId: id,
        revisionNumber: 1,
        jobId: job.id,
        companyId: job.companyId,
        buyerId: job.buyerId,
        createdBy: actor.id,
        invoiceNumber,
        issueDate: parsed.data.issueDate,
        dueDate: parsed.data.dueDate,
        subtotalCents: totals.subtotalCents,
        taxRateBps: parsed.data.taxRateBps,
        taxCents: totals.taxCents,
        discountCents: totals.discountCents,
        retainageRateBps: parsed.data.retainageRateBps,
        retainageCents: totals.retainageCents,
        totalCents: totals.totalCents,
        status: 'draft',
        notes: parsed.data.notes,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(invoiceItems).values(items),
      db.insert(invoiceStatusHistory).values({
        id: crypto.randomUUID(),
        invoiceId: id,
        oldStatus: null,
        newStatus: 'draft',
        changedBy: actor.id,
        createdAt: now,
      }),
    ])
    await writeAudit(c, {
      action: 'invoice.created',
      targetType: 'invoice',
      targetId: id,
      companyId: job.companyId,
      details: { invoiceNumber, companyRole },
    })
    return { id, invoiceNumber, ...totals, status: 'draft' as const }
  })
  return c.json(
    { data: result.value, meta: { replayed: result.replayed, requestId: c.get('requestId') } },
    201,
  )
})

app.patch('/invoices/:id', async (c) => {
  const invoiceId = uuidSchema.parse(c.req.param('id'))
  const parsed = invoiceSchema.safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_invoice',
      'Review the invoice.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  if (!invoice) throw new HttpError(404, 'invoice_not_found', 'Invoice not found.')
  if (invoice.status !== 'draft')
    throw new HttpError(
      409,
      'invoice_immutable',
      'Sent invoices cannot be edited. Create a revision instead.',
    )
  if (invoice.jobId !== parsed.data.jobId)
    throw new HttpError(409, 'invoice_job_immutable', 'An invoice cannot be moved to another job.')
  const { actor } = await requireJobCompanyAccess(c, invoice.companyId, invoice.jobId)
  const totals = calculateInvoiceTotals(parsed.data)
  const now = new Date().toISOString()
  const itemValues = parsed.data.items.map((item, index) => ({
    id: crypto.randomUUID(),
    invoiceId: invoice.id,
    ...item,
    lineTotalCents: Math.round((item.quantityMilli * item.unitPriceCents) / 1000),
    sortOrder: index,
  }))
  await db.batch([
    db
      .update(invoices)
      .set({
        issueDate: parsed.data.issueDate,
        dueDate: parsed.data.dueDate,
        subtotalCents: totals.subtotalCents,
        taxRateBps: parsed.data.taxRateBps,
        taxCents: totals.taxCents,
        discountCents: totals.discountCents,
        retainageRateBps: parsed.data.retainageRateBps,
        retainageCents: totals.retainageCents,
        totalCents: totals.totalCents,
        notes: parsed.data.notes,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id)),
    db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id)),
    db.insert(invoiceItems).values(itemValues),
  ])
  await writeAudit(c, {
    action: 'invoice.updated',
    targetType: 'invoice',
    targetId: invoice.id,
    companyId: invoice.companyId,
    details: { actorId: actor.id },
  })
  return ok(c, { id: invoice.id, ...totals, status: 'draft' })
})

app.post('/invoices/:id/revisions', async (c) => {
  const invoiceId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  if (!invoice) throw new HttpError(404, 'invoice_not_found', 'Invoice not found.')
  const { actor } = await requireCompanyMember(c, invoice.companyId, ['company_admin'])
  if (invoice.status === 'draft')
    throw new HttpError(409, 'revision_not_required', 'Edit the existing draft before it is sent.')
  const rootInvoiceId = invoice.rootInvoiceId ?? invoice.id
  const [latest] = await db
    .select({ revisionNumber: invoices.revisionNumber })
    .from(invoices)
    .where(eq(invoices.rootInvoiceId, rootInvoiceId))
    .orderBy(desc(invoices.revisionNumber))
    .limit(1)
  const root =
    rootInvoiceId === invoice.id
      ? invoice
      : (await db.select().from(invoices).where(eq(invoices.id, rootInvoiceId)).limit(1))[0]
  if (!root)
    throw new HttpError(500, 'invoice_root_missing', 'The original invoice could not be found.')
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoice.id))
    .orderBy(invoiceItems.sortOrder)
  const id = crypto.randomUUID()
  const revisionNumber = (latest?.revisionNumber ?? invoice.revisionNumber) + 1
  const now = new Date().toISOString()
  const invoiceNumber = `${root.invoiceNumber}-R${revisionNumber}`
  await db.batch([
    db.insert(invoices).values({
      ...invoice,
      id,
      rootInvoiceId,
      previousRevisionId: invoice.id,
      revisionNumber,
      invoiceNumber,
      createdBy: actor.id,
      status: 'draft',
      amountPaidCents: 0,
      sentAt: null,
      viewedAt: null,
      paidAt: null,
      voidedAt: null,
      pdfFileId: null,
      createdAt: now,
      updatedAt: now,
    }),
    db
      .insert(invoiceItems)
      .values(items.map((item) => ({ ...item, id: crypto.randomUUID(), invoiceId: id }))),
    db.insert(invoiceStatusHistory).values({
      id: crypto.randomUUID(),
      invoiceId: id,
      oldStatus: null,
      newStatus: 'draft',
      changedBy: actor.id,
      createdAt: now,
    }),
  ])
  await writeAudit(c, {
    action: 'invoice.revision_created',
    targetType: 'invoice',
    targetId: id,
    companyId: invoice.companyId,
    details: { previousRevisionId: invoice.id, revisionNumber },
  })
  return c.json(
    {
      data: { id, invoiceNumber, revisionNumber, status: 'draft' },
      meta: { requestId: c.get('requestId') },
    },
    201,
  )
})

app.post('/invoices/:id/void', async (c) => {
  const invoiceId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  if (!invoice) throw new HttpError(404, 'invoice_not_found', 'Invoice not found.')
  const { actor } = await requireCompanyMember(c, invoice.companyId, ['company_admin'])
  if (!canTransitionInvoice(invoice.status, 'void'))
    throw new HttpError(409, 'invalid_transition', 'This invoice cannot be voided.')
  const now = new Date().toISOString()
  await db.batch([
    db
      .update(invoices)
      .set({ status: 'void', voidedAt: now, updatedAt: now })
      .where(eq(invoices.id, invoice.id)),
    db.insert(invoiceStatusHistory).values({
      id: crypto.randomUUID(),
      invoiceId: invoice.id,
      oldStatus: invoice.status,
      newStatus: 'void',
      changedBy: actor.id,
      createdAt: now,
    }),
  ])
  await writeAudit(c, {
    action: 'invoice.voided',
    targetType: 'invoice',
    targetId: invoice.id,
    companyId: invoice.companyId,
  })
  return ok(c, { id: invoice.id, status: 'void' })
})

app.post('/invoices/:id/send', async (c) => {
  const invoiceId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  if (!invoice) throw new HttpError(404, 'invoice_not_found', 'Invoice not found.')
  const { actor } = await requireCompanyMember(c, invoice.companyId, ['company_admin'])
  if (!canTransitionInvoice(invoice.status, 'sent'))
    throw new HttpError(409, 'invalid_transition', 'Only a draft invoice can be sent.')
  const raw = await c.req.text()
  const result = await executeIdempotently(c, actor, 'invoice.send', raw || '{}', async () => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, invoice.jobId)).limit(1)
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, invoice.companyId))
      .limit(1)
    const [buyer] = await db.select().from(users).where(eq(users.id, invoice.buyerId)).limit(1)
    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id))
      .orderBy(invoiceItems.sortOrder)
    if (!job || !company || !buyer)
      throw new HttpError(
        500,
        'invoice_context_missing',
        'Invoice participants could not be loaded.',
      )
    if (!['awaiting_invoice', 'invoiced', 'paid', 'closed'].includes(job.status))
      throw new HttpError(
        409,
        'job_not_ready_for_invoice',
        'Mark the job as awaiting invoice before sending billing.',
      )
    const pdf = await createInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      companyName: company.name,
      buyerName: buyer.name,
      jobTitle: job.title,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      items,
      subtotalCents: invoice.subtotalCents,
      taxCents: invoice.taxCents,
      discountCents: invoice.discountCents,
      retainageCents: invoice.retainageCents,
      totalCents: invoice.totalCents,
      notes: invoice.notes,
    })
    const fileId = crypto.randomUUID()
    const objectKey = `invoices/${invoice.companyId}/${invoice.id}/revision-${invoice.revisionNumber}.pdf`
    const fileStorage = requireFileStorage(c)
    await fileStorage.put(objectKey, pdf, {
      httpMetadata: {
        contentType: 'application/pdf',
        contentDisposition: `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    })
    const checksum = await crypto.subtle.digest('SHA-256', new Uint8Array(pdf).buffer)
    const checksumSha256 = Array.from(new Uint8Array(checksum), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    const now = new Date().toISOString()
    const emailDeliveryId = crypto.randomUUID()
    await db.batch([
      db.insert(files).values({
        id: fileId,
        ownerUserId: actor.id,
        companyId: invoice.companyId,
        jobId: invoice.jobId,
        invoiceId: invoice.id,
        objectKey,
        originalName: `${invoice.invoiceNumber}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: pdf.byteLength,
        checksumSha256,
        visibility: 'invoice_participants',
        scanStatus: 'clean',
        createdAt: now,
      }),
      db
        .update(invoices)
        .set({ status: 'sent', sentAt: now, pdfFileId: fileId, updatedAt: now })
        .where(eq(invoices.id, invoice.id)),
      ...(job.status === 'awaiting_invoice'
        ? [
            db
              .update(jobs)
              .set({ status: 'invoiced', updatedAt: now })
              .where(eq(jobs.id, invoice.jobId)),
          ]
        : []),
      db.insert(invoiceStatusHistory).values({
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        oldStatus: 'draft',
        newStatus: 'sent',
        changedBy: actor.id,
        createdAt: now,
      }),
      db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: buyer.id,
        type: 'invoice_sent',
        title: 'New invoice',
        body: `${company.name} sent invoice ${invoice.invoiceNumber}.`,
        payloadJson: JSON.stringify({ invoiceId: invoice.id }),
        createdAt: now,
      }),
      db.insert(emailDeliveries).values({
        id: emailDeliveryId,
        userId: buyer.id,
        template: 'invoice_sent',
        recipientHash: buyer.id,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      }),
    ])
    await writeAudit(c, {
      action: 'invoice.sent',
      targetType: 'invoice',
      targetId: invoice.id,
      companyId: invoice.companyId,
    })
    const emailResult = await sendInvoiceEmail(c.env, {
      buyerEmail: buyer.email,
      buyerName: buyer.name,
      companyName: company.name,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalCents: invoice.totalCents,
    })
    try {
      await db
        .update(emailDeliveries)
        .set({
          status: emailResult.status,
          providerMessageId: emailResult.providerMessageId,
          lastErrorCode: emailResult.lastErrorCode,
          attempts: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(emailDeliveries.id, emailDeliveryId))
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'email delivery status update failed',
          requestId: c.get('requestId'),
          deliveryId: emailDeliveryId,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }
    return { id: invoice.id, status: 'sent' as const, pdfFileId: fileId }
  })
  return ok(c, result.value)
})

const paymentSchema = z.object({
  amountCents: z.number().int().positive(),
  paidAt: z.string().datetime(),
  method: z.enum(['cash', 'check', 'bank_transfer', 'card_external', 'other']),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
})
app.post('/invoices/:id/payments', async (c) => {
  const invoiceId = uuidSchema.parse(c.req.param('id'))
  const raw = await c.req.text()
  const parsed = paymentSchema.safeParse(JSON.parse(raw || '{}'))
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_payment',
      'Review the payment record.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  if (!invoice) throw new HttpError(404, 'invoice_not_found', 'Invoice not found.')
  const { actor } = await requireCompanyMember(c, invoice.companyId, ['company_admin'])
  const result = await executeIdempotently(c, actor, 'payment.record', raw, async () => {
    if (invoice.status === 'void' || invoice.status === 'draft')
      throw new HttpError(
        409,
        'invoice_not_payable',
        'This invoice cannot receive a payment record.',
      )
    const newPaid = invoice.amountPaidCents + parsed.data.amountCents
    if (newPaid > invoice.totalCents)
      throw new HttpError(
        422,
        'payment_exceeds_balance',
        'Payment exceeds the remaining invoice balance.',
      )
    const now = new Date().toISOString()
    const paid = newPaid === invoice.totalCents
    await db.batch([
      db.insert(invoicePayments).values({
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        recordedBy: actor.id,
        ...parsed.data,
        createdAt: now,
      }),
      db
        .update(invoices)
        .set({
          amountPaidCents: newPaid,
          status: paid ? 'paid' : invoice.status,
          paidAt: paid ? parsed.data.paidAt : invoice.paidAt,
          updatedAt: now,
        })
        .where(eq(invoices.id, invoice.id)),
      ...(paid
        ? [
            db.insert(invoiceStatusHistory).values({
              id: crypto.randomUUID(),
              invoiceId: invoice.id,
              oldStatus: invoice.status,
              newStatus: 'paid',
              changedBy: actor.id,
              createdAt: now,
            }),
            db
              .update(jobs)
              .set({ status: 'paid', updatedAt: now })
              .where(eq(jobs.id, invoice.jobId)),
          ]
        : []),
    ])
    await writeAudit(c, {
      action: 'invoice.payment_recorded',
      targetType: 'invoice',
      targetId: invoice.id,
      companyId: invoice.companyId,
      details: { amountCents: parsed.data.amountCents },
    })
    return {
      invoiceId: invoice.id,
      amountPaidCents: newPaid,
      balanceCents: invoice.totalCents - newPaid,
      status: paid ? 'paid' : invoice.status,
    }
  })
  return c.json(
    { data: result.value, meta: { replayed: result.replayed, requestId: c.get('requestId') } },
    201,
  )
})

app.post('/reviews', async (c) => {
  const actor = requireActor(c)
  const parsed = reviewSchema.safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_review',
      'Review the rating and comment.',
      validationFields(parsed.error),
    )
  const db = drizzle(c.env.DB)
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, parsed.data.jobId), eq(jobs.buyerId, actor.id)))
    .limit(1)
  if (!job || !['awaiting_invoice', 'invoiced', 'paid', 'closed'].includes(job.status))
    throw new HttpError(
      403,
      'review_not_allowed',
      'Reviews require a completed job owned by this buyer.',
    )
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  try {
    await db.insert(reviews).values({
      id,
      jobId: job.id,
      buyerId: actor.id,
      companyId: job.companyId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      status: 'published',
      createdAt: now,
      updatedAt: now,
    })
  } catch {
    throw new HttpError(409, 'review_exists', 'This job already has a review.')
  }
  await writeAudit(c, {
    action: 'review.created',
    targetType: 'review',
    targetId: id,
    companyId: job.companyId,
  })
  return c.json({ data: { id, status: 'published' }, meta: { requestId: c.get('requestId') } }, 201)
})

app.get('/notifications', async (c) => {
  const actor = requireActor(c)
  const db = drizzle(c.env.DB)
  return ok(
    c,
    await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, actor.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50),
  )
})

app.patch('/notifications/:id/read', async (c) => {
  const actor = requireActor(c)
  const id = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const result = await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, actor.id)))
    .returning({ id: notifications.id })
  if (!result[0]) throw new HttpError(404, 'notification_not_found', 'Notification not found.')
  return ok(c, { id, read: true })
})

app.post('/support', async (c) => {
  const parsed = supportRequestSchema.safeParse(await c.req.json())
  if (!parsed.success)
    throw new HttpError(
      422,
      'invalid_support_request',
      'Review the support request.',
      validationFields(parsed.error),
    )
  const actor = c.get('actor')
  const db = drizzle(c.env.DB)
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.insert(supportRequests).values({
    id,
    requesterId: actor?.id,
    ...parsed.data,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  })
  await writeAudit(c, {
    action: 'support_request.created',
    targetType: 'support_request',
    targetId: id,
    details: { type: parsed.data.type },
  })
  return c.json({ data: { id, status: 'open' }, meta: { requestId: c.get('requestId') } }, 201)
})

app.post('/uploads', bodyLimit({ maxSize: MAX_UPLOAD_BYTES }), async (c) => {
  const actor = requireActor(c)
  const contentLength = Number(c.req.header('content-length') || 0)
  if (!contentLength || contentLength > MAX_UPLOAD_BYTES)
    throw new HttpError(413, 'file_too_large', 'Files must be 20 MB or smaller.')
  const originalName = c.req.header('x-file-name')?.slice(0, 255)
  const declaredType = c.req.header('content-type')
  if (!originalName || !declaredType)
    throw new HttpError(
      422,
      'file_metadata_required',
      'Provide Content-Type and X-File-Name headers.',
    )
  const quoteRequestId = c.req.query('quoteRequestId')
  const jobId = c.req.query('jobId')
  if (quoteRequestId && jobId)
    throw new HttpError(
      422,
      'invalid_file_context',
      'Attach a file to either a request or a job, not both.',
    )
  const db = drizzle(c.env.DB)
  let companyId: string | undefined
  if (quoteRequestId) {
    const parsedQuoteId = uuidSchema.safeParse(quoteRequestId)
    if (!parsedQuoteId.success)
      throw new HttpError(422, 'invalid_file_context', 'The quote request identifier is invalid.')
    const [quote] = await db
      .select()
      .from(quoteRequests)
      .where(eq(quoteRequests.id, parsedQuoteId.data))
      .limit(1)
    if (!quote) throw new HttpError(404, 'quote_not_found', 'Quote request not found.')
    if (quote.buyerId !== actor.id)
      await requireQuoteCompanyAccess(c, quote.companyId, quote.assignedToUserId)
    companyId = quote.companyId
  }
  if (jobId) {
    const parsedJobId = uuidSchema.safeParse(jobId)
    if (!parsedJobId.success)
      throw new HttpError(422, 'invalid_file_context', 'The job identifier is invalid.')
    const [job] = await db.select().from(jobs).where(eq(jobs.id, parsedJobId.data)).limit(1)
    if (!job) throw new HttpError(404, 'job_not_found', 'Job not found.')
    if (job.buyerId !== actor.id) await requireJobCompanyAccess(c, job.companyId, job.id)
    companyId = job.companyId
  }
  const bytes = new Uint8Array(await c.req.arrayBuffer())
  const mimeType = validateFile(bytes.subarray(0, 16), declaredType)
  const id = crypto.randomUUID()
  const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1]
  const objectKey = `uploads/${actor.id}/${id}.${extension}`
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const checksumSha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  const fileStorage = requireFileStorage(c)
  await fileStorage.put(objectKey, bytes, { httpMetadata: { contentType: mimeType } })
  await db.insert(files).values({
    id,
    ownerUserId: actor.id,
    companyId,
    quoteRequestId,
    jobId,
    objectKey,
    originalName,
    mimeType,
    sizeBytes: bytes.byteLength,
    checksumSha256,
    visibility: quoteRequestId || jobId ? 'job_participants' : 'private',
    scanStatus: 'clean',
    createdAt: new Date().toISOString(),
  })
  await writeAudit(c, {
    action: 'file.uploaded',
    targetType: 'file',
    targetId: id,
    details: { mimeType, sizeBytes: bytes.byteLength },
  })
  return c.json(
    {
      data: {
        id,
        originalName,
        mimeType,
        sizeBytes: bytes.byteLength,
        scanStatus: 'clean',
      },
      meta: { requestId: c.get('requestId') },
    },
    201,
  )
})

app.get('/uploads/:id', async (c) => {
  const actor = requireActor(c)
  const file = await canAccessFile(c, actor, uuidSchema.parse(c.req.param('id')))
  if (file.scanStatus === 'rejected' || file.scanStatus === 'failed')
    throw new HttpError(403, 'file_unavailable', 'This file is unavailable.')
  const fileStorage = requireFileStorage(c)
  const object = await fileStorage.get(file.objectKey)
  if (!object) throw new HttpError(404, 'file_not_found', 'File not found.')
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set(
    'Content-Disposition',
    `attachment; filename="${file.originalName.replaceAll('"', '')}"`,
  )
  headers.set('Cache-Control', 'private, no-store')
  headers.set('ETag', object.httpEtag)
  return new Response(object.body, { headers })
})

app.get('/admin/companies/pending', async (c) => {
  requirePlatformRole(c, ['platform_admin'])
  const db = drizzle(c.env.DB)
  return ok(
    c,
    await db
      .select()
      .from(companies)
      .where(eq(companies.status, 'pending'))
      .orderBy(companies.createdAt)
      .limit(100),
  )
})

app.post('/admin/companies/:id/approve', async (c) => {
  const actor = requirePlatformRole(c, ['platform_admin'])
  const companyId = uuidSchema.parse(c.req.param('id'))
  const db = drizzle(c.env.DB)
  const now = new Date().toISOString()
  const result = await db
    .update(companies)
    .set({ status: 'verified', verifiedAt: now, updatedAt: now })
    .where(and(eq(companies.id, companyId), eq(companies.status, 'pending')))
    .returning({ id: companies.id })
  if (!result[0])
    throw new HttpError(409, 'company_not_pending', 'Only pending companies can be approved.')
  await writeAudit(c, {
    action: 'company.approved',
    targetType: 'company',
    targetId: companyId,
    companyId,
    details: { adminId: actor.id },
  })
  return ok(c, { id: companyId, status: 'verified' })
})

app.post('/admin/companies/:id/suspend', async (c) => {
  const actor = requirePlatformRole(c, ['platform_admin'])
  const companyId = uuidSchema.parse(c.req.param('id'))
  const reason = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(await c.req.json())
  const db = drizzle(c.env.DB)
  const now = new Date().toISOString()
  await db
    .update(companies)
    .set({ status: 'suspended', suspendedAt: now, updatedAt: now })
    .where(eq(companies.id, companyId))
  await writeAudit(c, {
    action: 'company.suspended',
    targetType: 'company',
    targetId: companyId,
    companyId,
    details: { adminId: actor.id, reason: reason.reason },
  })
  return ok(c, { id: companyId, status: 'suspended' })
})

app.get('/admin/audit', async (c) => {
  requirePlatformRole(c, ['platform_admin'])
  const db = drizzle(c.env.DB)
  return ok(c, await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(100))
})

app.delete('/admin/idempotency/expired', async (c) => {
  requirePlatformRole(c, ['platform_admin'])
  const db = drizzle(c.env.DB)
  const deleted = await db
    .delete(idempotencyKeys)
    .where(sql`${idempotencyKeys.expiresAt} < ${new Date().toISOString()}`)
    .returning({ key: idempotencyKeys.key })
  return ok(c, { deleted: deleted.length })
})
