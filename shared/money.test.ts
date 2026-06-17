import { describe, expect, it } from 'vitest'
import { calculateInvoiceTotals, formatMoney } from './money'

describe('calculateInvoiceTotals', () => {
  it('calculates construction invoice totals using integer math', () => {
    expect(
      calculateInvoiceTotals({
        items: [
          { quantityMilli: 2500, unitPriceCents: 10_000 },
          { quantityMilli: 1000, unitPriceCents: 5_000 },
        ],
        taxRateBps: 1025,
        discountCents: 2_000,
        retainageRateBps: 1000,
      }),
    ).toEqual({
      subtotalCents: 30_000,
      discountCents: 2_000,
      taxableCents: 28_000,
      taxCents: 2_870,
      retainageCents: 2_800,
      totalCents: 28_070,
    })
  })

  it('caps discounts at the subtotal and never returns a negative total', () => {
    expect(
      calculateInvoiceTotals({
        items: [{ quantityMilli: 1000, unitPriceCents: 1_000 }],
        taxRateBps: 0,
        discountCents: 5_000,
        retainageRateBps: 0,
      }).totalCents,
    ).toBe(0)
  })

  it('formats stored cents as USD', () => {
    expect(formatMoney(123_456)).toBe('$1,234.56')
  })
})
