import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendInvoiceEmail, type InvoiceEmailInput } from './email'
import type { AppBindings } from './types'

const env: Pick<
  AppBindings,
  'PUBLIC_APP_NAME' | 'PUBLIC_APP_URL' | 'RESEND_API_KEY' | 'SUPPORT_EMAIL'
> = {
  PUBLIC_APP_NAME: 'Workyard',
  PUBLIC_APP_URL: 'https://preview.contractor-marketplace.pages.dev',
  RESEND_API_KEY: 're_test',
  SUPPORT_EMAIL: 'support@example.com',
}

const invoice: InvoiceEmailInput = {
  buyerEmail: 'buyer@example.com',
  buyerName: 'Jordan Buyer',
  companyName: 'North Branch Electric',
  invoiceId: 'invoice_123',
  invoiceNumber: 'INV-2026-00001',
  totalCents: 125000,
}

describe('sendInvoiceEmail', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends invoice notifications through Resend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'email_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const result = await sendInvoiceEmail(env, invoice)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    if (typeof init.body !== 'string') {
      throw new Error('Expected Resend request body to be a JSON string')
    }
    const body = JSON.parse(init.body) as Record<string, unknown>

    expect(result).toEqual({
      status: 'sent',
      providerMessageId: 'email_123',
      lastErrorCode: null,
    })
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer re_test',
      'Content-Type': 'application/json',
    })
    expect(body).toMatchObject({
      from: 'Workyard <support@example.com>',
      to: ['buyer@example.com'],
      subject: 'Invoice INV-2026-00001 from North Branch Electric',
    })
    expect(String(body.text)).toContain('/dashboard/invoices')
  })

  it('fails without calling Resend when provider config is missing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(sendInvoiceEmail({ ...env, RESEND_API_KEY: undefined }, invoice)).resolves.toEqual(
      {
        status: 'failed',
        providerMessageId: null,
        lastErrorCode: 'provider_not_configured',
      },
    )
    await expect(sendInvoiceEmail({ ...env, SUPPORT_EMAIL: undefined }, invoice)).resolves.toEqual(
      {
        status: 'failed',
        providerMessageId: null,
        lastErrorCode: 'sender_not_configured',
      },
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports provider failures without throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad request', { status: 400 }))

    await expect(sendInvoiceEmail(env, invoice)).resolves.toEqual({
      status: 'failed',
      providerMessageId: null,
      lastErrorCode: 'resend_400',
    })
  })

  it('reports network failures without throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unavailable'))

    await expect(sendInvoiceEmail(env, invoice)).resolves.toEqual({
      status: 'failed',
      providerMessageId: null,
      lastErrorCode: 'provider_request_failed',
    })
  })
})
