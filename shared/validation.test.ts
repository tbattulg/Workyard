import { describe, expect, it } from 'vitest'
import {
  invoiceSchema,
  proposalSchema,
  quoteRequestSchema,
  serviceStatesSchema,
} from './validation'

const companyId = '11111111-1111-4111-8111-111111111111'
const jobId = '44444444-4444-4444-8444-444444444444'

describe('quote request validation', () => {
  it('normalizes state and accepts a complete request', () => {
    const result = quoteRequestSchema.parse({
      companyId,
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '303-555-0199',
      projectAddress: '1234 Market St',
      projectCity: 'Denver',
      projectState: 'co',
      projectZip: '80202',
      projectType: 'Electrical panel upgrade',
      jobDescription: 'Replace the electrical panel and inspect the service entrance.',
    })
    expect(result.projectState).toBe('CO')
  })

  it('rejects an inverted budget range', () => {
    const result = quoteRequestSchema.safeParse({
      companyId,
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '303-555-0199',
      projectAddress: '1234 Market St',
      projectCity: 'Denver',
      projectState: 'CO',
      projectZip: '80202',
      projectType: 'Electrical panel upgrade',
      jobDescription: 'Replace the electrical panel and inspect the service entrance.',
      budgetMinCents: 500_000,
      budgetMaxCents: 100_000,
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown state codes', () => {
    const result = quoteRequestSchema.safeParse({
      companyId,
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '303-555-0199',
      projectAddress: '1234 Market St',
      projectCity: 'Denver',
      projectState: 'ZZ',
      projectZip: '80202',
      projectType: 'Electrical panel upgrade',
      jobDescription: 'Replace the electrical panel and inspect the service entrance.',
    })
    expect(result.success).toBe(false)
  })
})

describe('service state validation', () => {
  it('normalizes and deduplicates service states', () => {
    const result = serviceStatesSchema.parse({ states: ['il', 'IN', 'IL'] })

    expect(result.states).toEqual(['IL', 'IN'])
  })

  it('requires at least one valid state code', () => {
    expect(serviceStatesSchema.safeParse({ states: [] }).success).toBe(false)
    expect(serviceStatesSchema.safeParse({ states: ['IL', 'ZZ'] }).success).toBe(false)
  })
})

describe('proposal validation', () => {
  it('accepts a lightweight fixed estimate without line items', () => {
    const result = proposalSchema.parse({
      quoteRequestId: '33333333-3333-4333-8333-333333333333',
      title: 'Electrical panel upgrade',
      summary: 'Replace the panel, label circuits, and coordinate one inspection.',
      priceType: 'fixed',
      priceMaxCents: 850_000,
      assumptions: 'Drywall repairs are excluded.',
    })

    expect(result.priceMaxCents).toBe(850_000)
  })

  it('rejects an inverted proposal price range', () => {
    const result = proposalSchema.safeParse({
      quoteRequestId: '33333333-3333-4333-8333-333333333333',
      title: 'Electrical panel upgrade',
      summary: 'Replace the panel, label circuits, and coordinate one inspection.',
      priceType: 'range',
      priceMinCents: 900_000,
      priceMaxCents: 850_000,
    })

    expect(result.success).toBe(false)
  })
})

describe('invoice validation', () => {
  it('requires a due date on or after the issue date', () => {
    const result = invoiceSchema.safeParse({
      jobId,
      issueDate: '2026-06-15',
      dueDate: '2026-06-14',
      items: [
        {
          description: 'Rough electrical labor',
          quantityMilli: 8000,
          unitPriceCents: 12_500,
          itemType: 'labor',
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects retainage above 100 percent', () => {
    const result = invoiceSchema.safeParse({
      jobId,
      issueDate: '2026-06-15',
      dueDate: '2026-07-15',
      retainageRateBps: 10_001,
      items: [
        {
          description: 'Rough electrical labor',
          quantityMilli: 8000,
          unitPriceCents: 12_500,
          itemType: 'labor',
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})
