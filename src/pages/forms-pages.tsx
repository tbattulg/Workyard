import { zodResolver } from '@hookform/resolvers/zod'
import { SignInButton, useAuth } from '@clerk/react'
import { CheckCircle2, FileUp, Minus, Plus, Send } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { calculateInvoiceTotals, formatMoney } from '../../shared/money'
import { invoiceSchema, supportRequestSchema } from '../../shared/validation'
import { Button, Card, Field, SecondaryButton } from '../components/ui'
import { apiRequest } from '../lib/api'
import { appConfig } from '../lib/config'

const quoteFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  projectAddress: z.string().trim().min(5).max(200),
  projectCity: z.string().trim().min(2).max(80),
  projectState: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  projectZip: z.string().regex(/^\d{5}$/),
  jobDescription: z.string().trim().min(20).max(5000),
  preferredStartDate: z.union([z.string().date(), z.literal('')]).optional(),
  budget: z.string().optional(),
})

type QuoteForm = z.infer<typeof quoteFormSchema>

export function QuoteRequestPage() {
  if (appConfig.clerkPublishableKey) {
    return <AuthenticatedQuoteRequestPage />
  }
  return <QuoteRequestForm />
}

function AuthenticatedQuoteRequestPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Card className="p-10 text-center">
          <h1 className="text-3xl font-black">Loading your session</h1>
        </Card>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Card className="p-10 text-center">
          <h1 className="text-3xl font-black">Sign in to request a quote</h1>
          <p className="mt-3 text-slate-600">
            Contractor Marketplace uses verified accounts to protect project details.
          </p>
          <SignInButton mode="modal">
            <Button className="mt-6" type="button">
              Sign in
            </Button>
          </SignInButton>
        </Card>
      </div>
    )
  }

  return <QuoteRequestForm getAuthToken={getToken} />
}

function QuoteRequestForm({ getAuthToken }: { getAuthToken?: () => Promise<string | null> }) {
  const [params] = useSearchParams()
  const [sent, setSent] = useState<'live' | 'demo' | 'failed' | false>(false)
  const companyId = params.get('company') ?? '11111111-1111-4111-8111-111111111111'
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<QuoteForm>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: { projectCity: 'Chicago', projectState: 'IL' },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(async (values) => {
      const budget = budgetRange(values.budget)
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        projectAddress: values.projectAddress,
        projectCity: values.projectCity,
        projectState: values.projectState,
        projectZip: values.projectZip,
        jobDescription: values.jobDescription,
        preferredStartDate: values.preferredStartDate || undefined,
      }
      try {
        const authToken = await getAuthToken?.()
        await apiRequest('/quotes', {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({ ...payload, ...budget, companyId }),
        }, { authToken })
        setSent('live')
      } catch {
        setSent(getAuthToken ? 'failed' : 'demo')
      }
    })(event)
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto text-emerald-600" size={54} />
          <h1 className="mt-5 text-3xl font-black">Your request is ready</h1>
          <p className="mt-3 text-slate-600">
            {sent === 'live'
              ? 'The contractor can now review the request in their lead inbox.'
              : sent === 'demo'
                ? 'In demo mode, no external message was sent. Connect Clerk and D1 to submit live requests.'
                : 'We could not submit the request. Please try again or contact support.'}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div>
        <p className="font-bold text-amber-700">Request a quote</p>
        <h1 className="mt-2 text-4xl font-black">Tell the contractor about the job</h1>
        <p className="mt-3 text-lg text-slate-600">
          Include enough detail for an informed first response. No payment is collected.
        </p>
      </div>

      <form className="mt-8 grid gap-6" onSubmit={submit}>
        <Card className="grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-xl font-black sm:col-span-2">Contact</h2>
          <Field id="name" label="Name">
            <input
              id="name"
              className="input"
              {...register('name')}
              aria-invalid={Boolean(errors.name)}
            />
          </Field>
          <Field id="email" label="Email">
            <input
              id="email"
              type="email"
              className="input"
              {...register('email')}
              aria-invalid={Boolean(errors.email)}
            />
          </Field>
          <Field id="phone" label="Phone">
            <input
              id="phone"
              className="input"
              {...register('phone')}
              aria-invalid={Boolean(errors.phone)}
            />
          </Field>
        </Card>

        <Card className="grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-xl font-black sm:col-span-2">Project location</h2>
          <Field id="address" label="Street address">
            <input id="address" className="input" {...register('projectAddress')} />
          </Field>
          <Field id="city" label="City">
            <input id="city" className="input" {...register('projectCity')} />
          </Field>
          <Field id="state" label="State">
            <input id="state" className="input" maxLength={2} {...register('projectState')} />
          </Field>
          <Field id="zip" label="ZIP code">
            <input id="zip" className="input" inputMode="numeric" {...register('projectZip')} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-6">
          <h2 className="text-xl font-black">Scope and timing</h2>
          <Field
            id="description"
            label="Describe the work"
            hint="Include current conditions, desired outcome, access constraints, and known dimensions."
          >
            <textarea
              id="description"
              className="input min-h-40 resize-y"
              {...register('jobDescription')}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="start" label="Preferred start date">
              <input id="start" type="date" className="input" {...register('preferredStartDate')} />
            </Field>
            <Field id="budget" label="Budget range (optional)">
              <select id="budget" className="input" {...register('budget')}>
                <option value="">Not sure yet</option>
                <option>Under $2,500</option>
                <option>$2,500-$10,000</option>
                <option>$10,000-$50,000</option>
                <option>$50,000+</option>
              </select>
            </Field>
          </div>
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-7 text-center">
            <FileUp className="mx-auto text-slate-500" />
            <p className="mt-3 font-bold">Photos and documents</p>
            <p className="mt-1 text-sm text-slate-500">
              JPEG, PNG, WebP, or PDF. Up to 20 MB each.
            </p>
            <SecondaryButton className="mt-4" type="button">
              Choose files
            </SecondaryButton>
          </div>
        </Card>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={isSubmitting}>
            <Send size={18} /> Submit request
          </Button>
        </div>
      </form>
    </div>
  )
}

type InvoiceForm = z.input<typeof invoiceSchema>

function budgetRange(value?: string) {
  switch (value) {
    case 'Under $2,500':
      return { budgetMaxCents: 250_000 }
    case '$2,500-$10,000':
      return { budgetMinCents: 250_000, budgetMaxCents: 1_000_000 }
    case '$10,000-$50,000':
      return { budgetMinCents: 1_000_000, budgetMaxCents: 5_000_000 }
    case '$50,000+':
      return { budgetMinCents: 5_000_000 }
    default:
      return {}
  }
}

export function InvoiceBuilderPage() {
  const {
    register,
    control,
    formState: { errors },
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      jobId: '44444444-4444-4444-8444-444444444444',
      issueDate: '2026-06-15',
      dueDate: '2026-07-15',
      taxRateBps: 1025,
      discountCents: 0,
      retainageRateBps: 0,
      items: [
        {
          description: 'Journeyman electrical labor',
          quantityMilli: 12000,
          unitPriceCents: 12500,
          itemType: 'labor',
          costCode: '26-0500',
        },
        {
          description: '200A panel and breakers',
          quantityMilli: 1000,
          unitPriceCents: 184000,
          itemType: 'material',
          costCode: '26-2400',
        },
      ],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const values = useWatch({ control })
  const totals = calculateInvoiceTotals({
    items:
      values.items?.map((item) => ({
        quantityMilli: Number(item?.quantityMilli) || 0,
        unitPriceCents: Number(item?.unitPriceCents) || 0,
      })) ?? [],
    taxRateBps: Number(values.taxRateBps) || 0,
    discountCents: Number(values.discountCents) || 0,
    retainageRateBps: Number(values.retainageRateBps) || 0,
  })

  return (
    <DashboardShell
      title="Build invoice"
      subtitle="Draft itemized billing tied to the completed job."
    >
      <form className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Card className="grid gap-5 p-6 sm:grid-cols-2">
            <Field id="issue" label="Issue date">
              <input id="issue" type="date" className="input" {...register('issueDate')} />
            </Field>
            <Field id="due" label="Due date">
              <input id="due" type="date" className="input" {...register('dueDate')} />
            </Field>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Line items</h2>
              <SecondaryButton
                type="button"
                onClick={() =>
                  append({
                    description: '',
                    quantityMilli: 1000,
                    unitPriceCents: 0,
                    itemType: 'labor',
                  })
                }
              >
                <Plus size={17} /> Add item
              </SecondaryButton>
            </div>
            <div className="mt-5 grid gap-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_130px_150px_44px]"
                >
                  <input
                    className="input"
                    aria-label={`Item ${index + 1} description`}
                    {...register(`items.${index}.description`)}
                  />
                  <Controller
                    control={control}
                    name={`items.${index}.quantityMilli`}
                    render={({ field: quantityField }) => (
                      <input
                        className="input"
                        type="number"
                        min="0.001"
                        step="0.001"
                        aria-label={`Item ${index + 1} quantity`}
                        value={Number(quantityField.value) / 1000}
                        onBlur={quantityField.onBlur}
                        onChange={(event) =>
                          quantityField.onChange(
                            Math.round(Number(event.currentTarget.value) * 1000),
                          )
                        }
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`items.${index}.unitPriceCents`}
                    render={({ field: priceField }) => (
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Item ${index + 1} unit price`}
                        value={Number(priceField.value) / 100}
                        onBlur={priceField.onBlur}
                        onChange={(event) =>
                          priceField.onChange(Math.round(Number(event.currentTarget.value) * 100))
                        }
                      />
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="grid size-11 place-items-center rounded-lg border border-slate-200 text-slate-500"
                    aria-label={`Remove item ${index + 1}`}
                  >
                    <Minus size={18} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="grid gap-5 p-6 sm:grid-cols-3">
            <Field id="tax" label="Tax rate (%)">
              <Controller
                control={control}
                name="taxRateBps"
                render={({ field }) => (
                  <input
                    id="tax"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="input"
                    value={Number(field.value) / 100}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(Math.round(Number(event.currentTarget.value) * 100))
                    }
                  />
                )}
              />
            </Field>
            <Field id="discount" label="Discount">
              <Controller
                control={control}
                name="discountCents"
                render={({ field }) => (
                  <input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={Number(field.value) / 100}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(Math.round(Number(event.currentTarget.value) * 100))
                    }
                  />
                )}
              />
            </Field>
            <Field id="retainage" label="Retainage (%)">
              <Controller
                control={control}
                name="retainageRateBps"
                render={({ field }) => (
                  <input
                    id="retainage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="input"
                    value={Number(field.value) / 100}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(Math.round(Number(event.currentTarget.value) * 100))
                    }
                  />
                )}
              />
            </Field>
          </Card>
        </div>

        <aside>
          <Card className="sticky top-6 p-6">
            <h2 className="text-xl font-black">Invoice summary</h2>
            <dl className="mt-5 grid gap-3 text-sm">
              <SummaryLine label="Subtotal" value={formatMoney(totals.subtotalCents)} />
              <SummaryLine label="Discount" value={`-${formatMoney(totals.discountCents)}`} />
              <SummaryLine label="Tax" value={formatMoney(totals.taxCents)} />
              <SummaryLine label="Retainage" value={`-${formatMoney(totals.retainageCents)}`} />
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-4 text-lg font-black">
                <dt>Total due</dt>
                <dd>{formatMoney(totals.totalCents)}</dd>
              </div>
            </dl>
            <div className="mt-6 grid gap-3">
              <Button type="button">Save draft</Button>
              <SecondaryButton type="button">Preview PDF</SecondaryButton>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Once sent, this invoice becomes immutable. Corrections create a new revision.
            </p>
            {Object.keys(errors).length ? (
              <p className="mt-3 text-sm font-bold text-red-700">
                Review the highlighted invoice fields.
              </p>
            ) : null}
          </Card>
        </aside>
      </form>
    </DashboardShell>
  )
}

export function SupportPage() {
  const { register, handleSubmit } = useForm<z.infer<typeof supportRequestSchema>>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: { type: 'support' },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(() => undefined)(event)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-black">Help and support</h1>
      <p className="mt-3 text-lg text-slate-600">
        Send a support request, report a dispute, or make a privacy request.
      </p>
      <Card className="mt-8 p-6">
        <form className="grid gap-5" onSubmit={submit}>
          <Field id="type" label="Request type">
            <select id="type" className="input" {...register('type')}>
              <option value="support">General support</option>
              <option value="dispute">Dispute</option>
              <option value="privacy">Privacy request</option>
            </select>
          </Field>
          <Field id="subject" label="Subject">
            <input id="subject" className="input" {...register('subject')} />
          </Field>
          <Field id="body" label="How can we help?">
            <textarea id="body" className="input min-h-40" {...register('body')} />
          </Field>
          <Button type="submit">Submit request</Button>
        </form>
      </Card>
    </div>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <main className="p-4 sm:p-7 lg:p-10">
      <header className="mb-7">
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="mt-2 text-slate-600">{subtitle}</p>
      </header>
      {children}
    </main>
  )
}
