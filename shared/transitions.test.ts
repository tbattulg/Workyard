import { describe, expect, it } from 'vitest'
import {
  canTransitionInvoice,
  canTransitionJob,
  canTransitionProposal,
  canTransitionQuote,
} from './transitions'

describe('workflow transitions', () => {
  it('allows the expected quote and proposal path', () => {
    expect(canTransitionQuote('new', 'ready_for_proposal')).toBe(true)
    expect(canTransitionQuote('ready_for_proposal', 'responded')).toBe(true)
    expect(canTransitionQuote('accepted', 'converted')).toBe(true)
    expect(canTransitionProposal('draft', 'sent')).toBe(true)
    expect(canTransitionProposal('sent', 'accepted')).toBe(true)
  })

  it('rejects backward and terminal transitions', () => {
    expect(canTransitionJob('closed', 'in_progress')).toBe(false)
    expect(canTransitionJob('invoiced', 'awaiting_invoice')).toBe(false)
    expect(canTransitionInvoice('paid', 'void')).toBe(false)
    expect(canTransitionProposal('accepted', 'sent')).toBe(false)
  })
})
