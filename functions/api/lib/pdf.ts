import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatMoney } from '../../../shared/money'

export async function createInvoicePdf(input: {
  invoiceNumber: string
  companyName: string
  buyerName: string
  jobTitle: string
  issueDate: string
  dueDate: string
  items: Array<{
    description: string
    quantityMilli: number
    unitPriceCents: number
    lineTotalCents: number
  }>
  subtotalCents: number
  taxCents: number
  discountCents: number
  retainageCents: number
  totalCents: number
  notes?: string | null
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let y = 744
  const draw = (text: string, x: number, size = 10, font = regular) => {
    page.drawText(text, { x, y, size, font, color: rgb(0.06, 0.09, 0.16) })
  }
  draw('INVOICE', 48, 24, bold)
  draw(input.invoiceNumber, 420, 12, bold)
  y -= 42
  draw(input.companyName, 48, 14, bold)
  draw(`Bill to: ${input.buyerName}`, 340, 10, bold)
  y -= 18
  draw(`Project: ${input.jobTitle}`, 48)
  draw(`Issued: ${input.issueDate}`, 340)
  y -= 16
  draw(`Due: ${input.dueDate}`, 340)
  y -= 34
  page.drawLine({
    start: { x: 48, y },
    end: { x: 564, y },
    thickness: 1,
    color: rgb(0.8, 0.82, 0.86),
  })
  y -= 20
  draw('Description', 48, 9, bold)
  draw('Qty', 340, 9, bold)
  draw('Unit', 410, 9, bold)
  draw('Amount', 500, 9, bold)
  y -= 18
  for (const item of input.items.slice(0, 18)) {
    draw(item.description.slice(0, 48), 48)
    draw((item.quantityMilli / 1000).toFixed(3).replace(/\.000$/, ''), 340)
    draw(formatMoney(item.unitPriceCents), 410)
    draw(formatMoney(item.lineTotalCents), 500)
    y -= 18
  }
  y -= 10
  page.drawLine({
    start: { x: 340, y },
    end: { x: 564, y },
    thickness: 1,
    color: rgb(0.8, 0.82, 0.86),
  })
  const totals = [
    ['Subtotal', input.subtotalCents],
    ['Discount', -input.discountCents],
    ['Tax', input.taxCents],
    ['Retainage', -input.retainageCents],
  ] as const
  for (const [label, amount] of totals) {
    y -= 18
    draw(label, 390)
    draw(formatMoney(amount), 500)
  }
  y -= 24
  draw('Total due', 390, 12, bold)
  draw(formatMoney(input.totalCents), 500, 12, bold)
  if (input.notes) {
    y -= 44
    draw('Notes', 48, 11, bold)
    y -= 16
    draw(input.notes.slice(0, 100), 48)
  }
  return pdf.save()
}
