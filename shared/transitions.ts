import type { InvoiceStatus, JobStatus, ProposalStatus, QuoteStatus } from './domain'

const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  new: ['viewed', 'responded', 'declined', 'expired'],
  viewed: ['responded', 'declined', 'expired'],
  responded: ['accepted', 'declined', 'expired'],
  accepted: ['converted'],
  declined: [],
  expired: [],
  converted: [],
}

const PROPOSAL_TRANSITIONS: Record<ProposalStatus, readonly ProposalStatus[]> = {
  draft: ['sent', 'withdrawn'],
  sent: ['accepted', 'declined', 'expired', 'withdrawn'],
  accepted: [],
  declined: [],
  expired: [],
  withdrawn: [],
}

const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  accepted: ['scheduled', 'in_progress', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['awaiting_invoice', 'cancelled'],
  awaiting_invoice: ['invoiced', 'in_progress'],
  invoiced: ['paid'],
  paid: ['closed'],
  closed: [],
  cancelled: [],
}

const INVOICE_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ['sent', 'void'],
  sent: ['viewed', 'overdue', 'paid', 'void'],
  viewed: ['overdue', 'paid', 'void'],
  overdue: ['paid', 'void'],
  paid: [],
  void: [],
}

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from].includes(to)
}

export function canTransitionProposal(from: ProposalStatus, to: ProposalStatus): boolean {
  return PROPOSAL_TRANSITIONS[from].includes(to)
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to)
}

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from].includes(to)
}
