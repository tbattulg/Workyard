import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import {
  CHANGE_ORDER_STATUSES,
  COMPANY_STATUSES,
  INVOICE_STATUSES,
  JOB_STATUSES,
  PROPOSAL_STATUSES,
  QUOTE_STATUSES,
  USER_ROLES,
} from '../domain'

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    clerkUserId: text('clerk_user_id').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    platformRole: text('platform_role', { enum: USER_ROLES }).notNull().default('buyer'),
    status: text('status', { enum: ['active', 'suspended', 'deleted'] })
      .notNull()
      .default('active'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_clerk_user_id_unique').on(table.clerkUserId),
    uniqueIndex('users_email_unique').on(table.email),
  ],
)

export const companies = sqliteTable(
  'companies',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    licenseNumber: text('license_number'),
    website: text('website'),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    addressLine1: text('address_line_1'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    zip: text('zip').notNull(),
    serviceRadiusMiles: integer('service_radius_miles').notNull().default(25),
    status: text('status', { enum: COMPANY_STATUSES }).notNull().default('draft'),
    verifiedAt: text('verified_at'),
    suspendedAt: text('suspended_at'),
    deletedAt: text('deleted_at'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('companies_slug_unique').on(table.slug),
    index('companies_search_idx').on(table.status, table.city, table.state),
  ],
)

export const companyMembers = sqliteTable(
  'company_members',
  {
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role', { enum: ['company_admin', 'staff'] }).notNull(),
    status: text('status', { enum: ['invited', 'active', 'removed'] })
      .notNull()
      .default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.companyId, table.userId] }),
    index('company_members_user_idx').on(table.userId, table.status),
  ],
)

export const companyVerificationDocuments = sqliteTable('company_verification_documents', {
  id: text('id').primaryKey(),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id),
  type: text('type', {
    enum: ['business_registration', 'license', 'insurance', 'identity', 'other'],
  }).notNull(),
  fileId: text('file_id'),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'expired'] })
    .notNull()
    .default('pending'),
  expiresAt: text('expires_at'),
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: text('reviewed_at'),
  notes: text('notes'),
  ...timestamps,
})

export const serviceCategories = sqliteTable('service_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
})

export const services = sqliteTable(
  'services',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    categoryId: text('category_id')
      .notNull()
      .references(() => serviceCategories.id),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    pricingType: text('pricing_type', { enum: ['quote', 'hourly', 'starting_at'] })
      .notNull()
      .default('quote'),
    startingPriceCents: integer('starting_price_cents'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('services_company_slug_unique').on(table.companyId, table.slug),
    index('services_category_idx').on(table.categoryId, table.active),
  ],
)

export const companyServiceAreas = sqliteTable(
  'company_service_areas',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    city: text('city').notNull(),
    state: text('state').notNull(),
    zip: text('zip'),
    radiusMiles: integer('radius_miles'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('company_service_areas_lookup_idx').on(table.state, table.city, table.zip)],
)

export const favorites = sqliteTable(
  'favorites',
  {
    buyerId: text('buyer_id')
      .notNull()
      .references(() => users.id),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.buyerId, table.companyId] })],
)

export const quoteRequests = sqliteTable(
  'quote_requests',
  {
    id: text('id').primaryKey(),
    buyerId: text('buyer_id')
      .notNull()
      .references(() => users.id),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    serviceId: text('service_id').references(() => services.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    projectAddress: text('project_address').notNull(),
    projectCity: text('project_city').notNull(),
    projectState: text('project_state').notNull(),
    projectZip: text('project_zip').notNull(),
    projectType: text('project_type').notNull().default('General project'),
    normalizedAddress: text('normalized_address'),
    latitudeE6: integer('latitude_e6'),
    longitudeE6: integer('longitude_e6'),
    jobDescription: text('job_description').notNull(),
    preferredStartDate: text('preferred_start_date'),
    budgetMinCents: integer('budget_min_cents'),
    budgetMaxCents: integer('budget_max_cents'),
    status: text('status', { enum: QUOTE_STATUSES }).notNull().default('new'),
    ...timestamps,
  },
  (table) => [
    index('quote_requests_buyer_idx').on(table.buyerId, table.createdAt),
    index('quote_requests_company_idx').on(table.companyId, table.status, table.createdAt),
    index('quote_requests_assignee_idx').on(table.assignedToUserId, table.status, table.createdAt),
  ],
)

export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    companyId: text('company_id').references(() => companies.id),
    quoteRequestId: text('quote_request_id').references(() => quoteRequests.id),
    jobId: text('job_id'),
    invoiceId: text('invoice_id'),
    objectKey: text('object_key').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksumSha256: text('checksum_sha256').notNull(),
    visibility: text('visibility', {
      enum: ['private', 'job_participants', 'invoice_participants'],
    })
      .notNull()
      .default('private'),
    scanStatus: text('scan_status', { enum: ['pending', 'clean', 'rejected', 'failed'] })
      .notNull()
      .default('pending'),
    createdAt: text('created_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    uniqueIndex('files_object_key_unique').on(table.objectKey),
    index('files_quote_idx').on(table.quoteRequestId),
    index('files_job_idx').on(table.jobId),
  ],
)

export const messageThreads = sqliteTable('message_threads', {
  id: text('id').primaryKey(),
  quoteRequestId: text('quote_request_id').references(() => quoteRequests.id),
  jobId: text('job_id'),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id),
  buyerId: text('buyer_id')
    .notNull()
    .references(() => users.id),
  subject: text('subject').notNull(),
  lastMessageAt: text('last_message_at'),
  ...timestamps,
})

export const threadParticipants = sqliteTable(
  'thread_participants',
  {
    threadId: text('thread_id')
      .notNull()
      .references(() => messageThreads.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    lastReadAt: text('last_read_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.threadId, table.userId] })],
)

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id')
      .notNull()
      .references(() => messageThreads.id),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: text('created_at').notNull(),
    editedAt: text('edited_at'),
    deletedAt: text('deleted_at'),
  },
  (table) => [index('messages_thread_idx').on(table.threadId, table.createdAt)],
)

export const proposals = sqliteTable(
  'proposals',
  {
    id: text('id').primaryKey(),
    quoteRequestId: text('quote_request_id')
      .notNull()
      .references(() => quoteRequests.id),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    priceType: text('price_type', { enum: ['fixed', 'range'] })
      .notNull()
      .default('fixed'),
    priceMinCents: integer('price_min_cents'),
    priceMaxCents: integer('price_max_cents'),
    assumptions: text('assumptions'),
    validUntil: text('valid_until'),
    notes: text('notes'),
    status: text('status', { enum: PROPOSAL_STATUSES }).notNull().default('draft'),
    sentAt: text('sent_at'),
    respondedAt: text('responded_at'),
    ...timestamps,
  },
  (table) => [index('proposals_quote_idx').on(table.quoteRequestId, table.createdAt)],
)

export const proposalItems = sqliteTable('proposal_items', {
  id: text('id').primaryKey(),
  proposalId: text('proposal_id')
    .notNull()
    .references(() => proposals.id),
  description: text('description').notNull(),
  quantityMilli: integer('quantity_milli').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  lineTotalCents: integer('line_total_cents').notNull(),
  itemType: text('item_type', {
    enum: ['labor', 'material', 'equipment', 'fee', 'change_order'],
  }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    quoteRequestId: text('quote_request_id')
      .notNull()
      .references(() => quoteRequests.id),
    acceptedProposalId: text('accepted_proposal_id')
      .notNull()
      .references(() => proposals.id),
    buyerId: text('buyer_id')
      .notNull()
      .references(() => users.id),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    threadId: text('thread_id')
      .notNull()
      .references(() => messageThreads.id),
    title: text('title').notNull(),
    scopeSummary: text('scope_summary').notNull(),
    siteAddress: text('site_address').notNull(),
    status: text('status', { enum: JOB_STATUSES }).notNull().default('accepted'),
    startDate: text('start_date'),
    completionDate: text('completion_date'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('jobs_quote_unique').on(table.quoteRequestId),
    index('jobs_company_idx').on(table.companyId, table.status),
    index('jobs_buyer_idx').on(table.buyerId, table.status),
  ],
)

export const jobAssignments = sqliteTable(
  'job_assignments',
  {
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    assignedBy: text('assigned_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.jobId, table.userId] })],
)

export const jobStatusHistory = sqliteTable('job_status_history', {
  id: text('id').primaryKey(),
  jobId: text('job_id')
    .notNull()
    .references(() => jobs.id),
  oldStatus: text('old_status', { enum: JOB_STATUSES }),
  newStatus: text('new_status', { enum: JOB_STATUSES }).notNull(),
  changedBy: text('changed_by')
    .notNull()
    .references(() => users.id),
  note: text('note'),
  createdAt: text('created_at').notNull(),
})

export const jobNotes = sqliteTable('job_notes', {
  id: text('id').primaryKey(),
  jobId: text('job_id')
    .notNull()
    .references(() => jobs.id),
  authorId: text('author_id')
    .notNull()
    .references(() => users.id),
  body: text('body').notNull(),
  visibility: text('visibility', { enum: ['company_only', 'all_participants'] })
    .notNull()
    .default('company_only'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const changeOrders = sqliteTable('change_orders', {
  id: text('id').primaryKey(),
  jobId: text('job_id')
    .notNull()
    .references(() => jobs.id),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  subtotalCents: integer('subtotal_cents').notNull(),
  status: text('status', { enum: CHANGE_ORDER_STATUSES }).notNull().default('draft'),
  submittedAt: text('submitted_at'),
  respondedAt: text('responded_at'),
  respondedBy: text('responded_by').references(() => users.id),
  ...timestamps,
})

export const changeOrderItems = sqliteTable('change_order_items', {
  id: text('id').primaryKey(),
  changeOrderId: text('change_order_id')
    .notNull()
    .references(() => changeOrders.id),
  description: text('description').notNull(),
  quantityMilli: integer('quantity_milli').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  lineTotalCents: integer('line_total_cents').notNull(),
  itemType: text('item_type', { enum: ['labor', 'material', 'equipment', 'fee'] }).notNull(),
})

export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    rootInvoiceId: text('root_invoice_id'),
    previousRevisionId: text('previous_revision_id'),
    revisionNumber: integer('revision_number').notNull().default(1),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    buyerId: text('buyer_id')
      .notNull()
      .references(() => users.id),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    invoiceNumber: text('invoice_number').notNull(),
    issueDate: text('issue_date').notNull(),
    dueDate: text('due_date').notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    taxRateBps: integer('tax_rate_bps').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    retainageRateBps: integer('retainage_rate_bps').notNull().default(0),
    retainageCents: integer('retainage_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    amountPaidCents: integer('amount_paid_cents').notNull().default(0),
    status: text('status', { enum: INVOICE_STATUSES }).notNull().default('draft'),
    notes: text('notes'),
    sentAt: text('sent_at'),
    viewedAt: text('viewed_at'),
    paidAt: text('paid_at'),
    voidedAt: text('voided_at'),
    pdfFileId: text('pdf_file_id'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('invoices_company_number_unique').on(table.companyId, table.invoiceNumber),
    index('invoices_job_idx').on(table.jobId, table.revisionNumber),
    index('invoices_buyer_idx').on(table.buyerId, table.status),
  ],
)

export const invoiceSequences = sqliteTable(
  'invoice_sequences',
  {
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    year: integer('year').notNull(),
    nextNumber: integer('next_number').notNull(),
  },
  (table) => [primaryKey({ columns: [table.companyId, table.year] })],
)

export const invoiceItems = sqliteTable('invoice_items', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id),
  description: text('description').notNull(),
  quantityMilli: integer('quantity_milli').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  lineTotalCents: integer('line_total_cents').notNull(),
  itemType: text('item_type', {
    enum: ['labor', 'material', 'equipment', 'fee', 'change_order'],
  }).notNull(),
  costCode: text('cost_code'),
  workPhase: text('work_phase'),
  changeOrderId: text('change_order_id').references(() => changeOrders.id),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const invoiceStatusHistory = sqliteTable('invoice_status_history', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id),
  oldStatus: text('old_status', { enum: INVOICE_STATUSES }),
  newStatus: text('new_status', { enum: INVOICE_STATUSES }).notNull(),
  changedBy: text('changed_by')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
})

export const invoicePayments = sqliteTable('invoice_payments', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id),
  recordedBy: text('recorded_by')
    .notNull()
    .references(() => users.id),
  amountCents: integer('amount_cents').notNull(),
  paidAt: text('paid_at').notNull(),
  method: text('method', {
    enum: ['cash', 'check', 'bank_transfer', 'card_external', 'other'],
  }).notNull(),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
})

export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id),
    buyerId: text('buyer_id')
      .notNull()
      .references(() => users.id),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    status: text('status', { enum: ['published', 'hidden', 'flagged'] })
      .notNull()
      .default('published'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('reviews_job_buyer_unique').on(table.jobId, table.buyerId),
    index('reviews_company_idx').on(table.companyId, table.status),
  ],
)

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    payloadJson: text('payload_json').notNull().default('{}'),
    readAt: text('read_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId, table.readAt, table.createdAt)],
)

export const notificationPreferences = sqliteTable('notification_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  emailLeads: integer('email_leads', { mode: 'boolean' }).notNull().default(true),
  emailMessages: integer('email_messages', { mode: 'boolean' }).notNull().default(true),
  emailJobs: integer('email_jobs', { mode: 'boolean' }).notNull().default(true),
  emailInvoices: integer('email_invoices', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull(),
})

export const supportRequests = sqliteTable('support_requests', {
  id: text('id').primaryKey(),
  requesterId: text('requester_id').references(() => users.id),
  type: text('type', { enum: ['support', 'dispute', 'privacy'] }).notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status', { enum: ['open', 'investigating', 'waiting', 'resolved', 'closed'] })
    .notNull()
    .default('open'),
  assignedAdminId: text('assigned_admin_id').references(() => users.id),
  ...timestamps,
})

export const disputes = sqliteTable('disputes', {
  id: text('id').primaryKey(),
  supportRequestId: text('support_request_id')
    .notNull()
    .references(() => supportRequests.id),
  jobId: text('job_id').references(() => jobs.id),
  invoiceId: text('invoice_id').references(() => invoices.id),
  openedBy: text('opened_by')
    .notNull()
    .references(() => users.id),
  companyId: text('company_id').references(() => companies.id),
  resolution: text('resolution'),
  resolvedAt: text('resolved_at'),
  ...timestamps,
})

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    companyId: text('company_id').references(() => companies.id),
    requestId: text('request_id').notNull(),
    detailsJson: text('details_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('audit_events_target_idx').on(table.targetType, table.targetId),
    index('audit_events_actor_idx').on(table.actorId, table.createdAt),
  ],
)

export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    key: text('key').notNull(),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id),
    operation: text('operation').notNull(),
    requestHash: text('request_hash').notNull(),
    responseJson: text('response_json').notNull(),
    statusCode: integer('status_code').notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.actorId, table.operation] }),
    index('idempotency_expiry_idx').on(table.expiresAt),
  ],
)

export const emailDeliveries = sqliteTable('email_deliveries', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  template: text('template').notNull(),
  recipientHash: text('recipient_hash').notNull(),
  providerMessageId: text('provider_message_id'),
  status: text('status', { enum: ['queued', 'sent', 'delivered', 'bounced', 'failed'] })
    .notNull()
    .default('queued'),
  lastErrorCode: text('last_error_code'),
  attempts: integer('attempts').notNull().default(0),
  ...timestamps,
})
