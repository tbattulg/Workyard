import { z } from 'zod'
import { isUsStateCode } from './us-states'

export const uuidSchema = z.string().uuid()

export const stateCodeSchema = z
  .string()
  .trim()
  .length(2)
  .transform((value) => value.toUpperCase())
  .refine(isUsStateCode, 'Use a valid U.S. state code.')

export const serviceStatesSchema = z.object({
  states: z
    .array(stateCodeSchema)
    .min(1)
    .max(50)
    .transform((states) => [...new Set(states)]),
})

export const cursorQuerySchema = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const companySearchSchema = cursorQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  state: stateCodeSchema.optional(),
  zip: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
})

export const quoteRequestSchema = z
  .object({
    companyId: uuidSchema,
    serviceId: uuidSchema.optional(),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(7).max(30),
    projectAddress: z.string().trim().min(5).max(200),
    projectCity: z.string().trim().min(2).max(80),
    projectState: stateCodeSchema,
    projectZip: z.string().regex(/^\d{5}$/),
    jobDescription: z.string().trim().min(20).max(5000),
    preferredStartDate: z.string().date().optional(),
    budgetMinCents: z.number().int().nonnegative().optional(),
    budgetMaxCents: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.budgetMinCents !== undefined &&
      value.budgetMaxCents !== undefined &&
      value.budgetMinCents > value.budgetMaxCents
    ) {
      context.addIssue({
        code: 'custom',
        path: ['budgetMaxCents'],
        message: 'Maximum budget must be greater than or equal to minimum budget.',
      })
    }
  })

export const proposalSchema = z.object({
  quoteRequestId: uuidSchema,
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(20).max(5000),
  validUntil: z.string().date().optional(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(2).max(500),
        quantityMilli: z.number().int().positive(),
        unitPriceCents: z.number().int().nonnegative(),
        itemType: z.enum(['labor', 'material', 'equipment', 'fee', 'change_order']),
      }),
    )
    .min(1)
    .max(100),
})

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

export const jobStatusSchema = z.object({
  status: z.enum([
    'accepted',
    'scheduled',
    'in_progress',
    'awaiting_invoice',
    'invoiced',
    'paid',
    'closed',
    'cancelled',
  ]),
  note: z.string().trim().max(1000).optional(),
})

export const invoiceSchema = z
  .object({
    jobId: uuidSchema,
    issueDate: z.string().date(),
    dueDate: z.string().date(),
    taxRateBps: z.number().int().min(0).max(10000).default(0),
    discountCents: z.number().int().nonnegative().default(0),
    retainageRateBps: z.number().int().min(0).max(10000).default(0),
    notes: z.string().trim().max(5000).optional(),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(2).max(500),
          quantityMilli: z.number().int().positive(),
          unitPriceCents: z.number().int().nonnegative(),
          itemType: z.enum(['labor', 'material', 'equipment', 'fee', 'change_order']),
          costCode: z.string().trim().max(50).optional(),
          workPhase: z.string().trim().max(100).optional(),
          changeOrderId: uuidSchema.optional(),
        }),
      )
      .min(1)
      .max(200),
  })
  .superRefine((value, context) => {
    if (value.dueDate < value.issueDate) {
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Due date cannot be before the issue date.',
      })
    }
  })

export const reviewSchema = z.object({
  jobId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(2000),
})

export const supportRequestSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(20).max(5000),
  type: z.enum(['support', 'dispute', 'privacy']),
})

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>
export type ProposalInput = z.infer<typeof proposalSchema>
export type InvoiceInput = z.infer<typeof invoiceSchema>
