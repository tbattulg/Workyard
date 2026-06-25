import type { AppBindings } from './types'

export type EmailDeliveryResult =
  | {
      status: 'sent'
      providerMessageId: string | null
      lastErrorCode: null
    }
  | {
      status: 'failed'
      providerMessageId: null
      lastErrorCode: string
    }

export interface InvoiceEmailInput {
  buyerEmail: string
  buyerName: string
  companyName: string
  invoiceId: string
  invoiceNumber: string
  totalCents: number
}

interface ResendEmailResponse {
  id?: string
  name?: string
  message?: string
}

export async function sendInvoiceEmail(
  env: Pick<AppBindings, 'PUBLIC_APP_NAME' | 'PUBLIC_APP_URL' | 'RESEND_API_KEY' | 'SUPPORT_EMAIL'>,
  input: InvoiceEmailInput,
): Promise<EmailDeliveryResult> {
  if (!env.RESEND_API_KEY) {
    return failed('provider_not_configured')
  }
  if (!env.SUPPORT_EMAIL) {
    return failed('sender_not_configured')
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.PUBLIC_APP_NAME} <${env.SUPPORT_EMAIL}>`,
        to: [input.buyerEmail],
        subject: `Invoice ${input.invoiceNumber} from ${input.companyName}`,
        text: invoiceEmailText(env, input),
      }),
    })

    if (!response.ok) {
      return failed(`resend_${response.status}`)
    }

    const body = (await response.json().catch(() => ({}))) as ResendEmailResponse
    return {
      status: 'sent',
      providerMessageId: typeof body.id === 'string' ? body.id : null,
      lastErrorCode: null,
    }
  } catch {
    return failed('provider_request_failed')
  }
}

function invoiceEmailText(
  env: Pick<AppBindings, 'PUBLIC_APP_NAME' | 'PUBLIC_APP_URL'>,
  input: InvoiceEmailInput,
) {
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(input.totalCents / 100)

  return [
    `Hi ${input.buyerName},`,
    '',
    `${input.companyName} sent invoice ${input.invoiceNumber} for ${amount}.`,
    '',
    `Sign in to view the invoice: ${env.PUBLIC_APP_URL}/dashboard/invoices`,
    '',
    `Invoice ID: ${input.invoiceId}`,
    '',
    `Thank you,`,
    env.PUBLIC_APP_NAME,
  ].join('\n')
}

function failed(lastErrorCode: string): EmailDeliveryResult {
  return {
    status: 'failed',
    providerMessageId: null,
    lastErrorCode,
  }
}
