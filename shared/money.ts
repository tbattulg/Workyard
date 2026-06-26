export interface InvoiceCalculationInput {
  items: Array<{ quantityMilli: number; unitPriceCents: number }>
  taxRateBps: number
  discountCents: number
  retainageRateBps: number
}

export interface InvoiceTotals {
  subtotalCents: number
  discountCents: number
  taxableCents: number
  taxCents: number
  retainageCents: number
  totalCents: number
}

function divideAndRound(numerator: number, denominator: number): number {
  return Math.round(numerator / denominator)
}

export function calculateInvoiceTotals(input: InvoiceCalculationInput): InvoiceTotals {
  const subtotalCents = input.items.reduce(
    (sum, item) => sum + divideAndRound(item.quantityMilli * item.unitPriceCents, 1000),
    0,
  )
  const discountCents = Math.min(input.discountCents, subtotalCents)
  const taxableCents = Math.max(0, subtotalCents - discountCents)
  const taxCents = divideAndRound(taxableCents * input.taxRateBps, 10000)
  const retainageCents = divideAndRound(taxableCents * input.retainageRateBps, 10000)
  const totalCents = Math.max(0, taxableCents + taxCents - retainageCents)

  return {
    subtotalCents,
    discountCents,
    taxableCents,
    taxCents,
    retainageCents,
    totalCents,
  }
}

export function formatMoney(cents: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}
