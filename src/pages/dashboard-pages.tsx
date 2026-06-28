import {
  ArrowUpRight,
  BadgeCheck,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Eye,
  FilePenLine,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Star,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@clerk/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { buyerMetrics, companyMetrics } from '../data/demo'
import { formatMoney } from '../../shared/money'
import type { ProposalStatus, QuoteStatus } from '../../shared/domain'
import { US_STATES } from '../../shared/us-states'
import { apiRequest, ApiError } from '../lib/api'
import { appConfig } from '../lib/config'
import { Badge, Button, Card, Field, SecondaryButton } from '../components/ui'

const DEMO_COMPANY_ID = '11111111-1111-4111-8111-111111111111'

type CompanyMembership = {
  companyId: string
  companyName: string
  role: 'company_admin' | 'staff'
  companyStatus: string
}

type MeResponse = {
  id: string
  memberships: CompanyMembership[]
}

type ServiceCategory = {
  id: string
  name: string
  slug: string
  description?: string | null
}

type CompanyOnboardingProfile = {
  id: string
  name: string
  description: string
  licenseNumber?: string | null
  website?: string | null
  phone: string
  email: string
  city: string
  state: string
  zip: string
  serviceRadiusMiles: number
  status: string
  serviceStates: string[]
  serviceCategoryIds: string[]
  categories?: string[]
  updatedAt?: string
}

type CompanyOnboardingDraft = {
  name: string
  description: string
  licenseNumber: string
  website: string
  phone: string
  email: string
  city: string
  state: string
  zip: string
  serviceRadiusMiles: number
  serviceStates: string[]
  serviceCategoryIds: string[]
  status: string
}

type CompanyOnboardingSaveResponse = {
  id: string
  slug?: string
  status: string
  serviceStates?: string[]
  serviceCategoryIds?: string[]
}

type AdminCompanySummary = {
  id: string
  name: string
  description: string
  licenseNumber?: string | null
  website?: string | null
  phone: string
  email: string
  city: string
  state: string
  status: string
  createdAt?: string
  updatedAt?: string
}

type QuoteSummary = {
  id: string
  buyerId?: string
  companyId: string
  serviceId?: string | null
  name: string
  email: string
  phone: string
  projectAddress: string
  projectCity: string
  projectState: string
  projectZip: string
  projectType: string
  jobDescription: string
  preferredStartDate?: string | null
  budgetMinCents?: number | null
  budgetMaxCents?: number | null
  status: QuoteStatus
  createdAt: string
  updatedAt: string
}

type ProposalSummary = {
  id: string
  quoteRequestId: string
  companyId: string
  companyName?: string
  title: string
  summary: string
  subtotalCents: number
  priceType: 'fixed' | 'range'
  priceMinCents?: number | null
  priceMaxCents?: number | null
  assumptions?: string | null
  validUntil?: string | null
  notes?: string | null
  status: ProposalStatus
  sentAt?: string | null
  respondedAt?: string | null
  projectType?: string
  projectCity?: string
  projectState?: string
}

type ProposalDraft = {
  title: string
  summary: string
  priceType: 'fixed' | 'range'
  fixedAmount: string
  minAmount: string
  maxAmount: string
  assumptions: string
  validUntil: string
  notes: string
}

const demoCompanyLeads: QuoteSummary[] = [
  {
    id: 'demo-lead-1',
    companyId: DEMO_COMPANY_ID,
    name: 'Morgan Lee',
    email: 'morgan@example.com',
    phone: '216-555-0191',
    projectAddress: '41 W Lakeside Ave',
    projectCity: 'Cleveland',
    projectState: 'OH',
    projectZip: '44114',
    projectType: 'Electrical panel upgrade',
    jobDescription:
      'Replace an older 200A panel, inspect the service entrance, and identify any immediate code corrections.',
    preferredStartDate: '2026-07-08',
    budgetMinCents: 250000,
    budgetMaxCents: 1000000,
    status: 'new',
    createdAt: '2026-06-27T15:18:00.000Z',
    updatedAt: '2026-06-27T15:18:00.000Z',
  },
  {
    id: 'demo-lead-2',
    companyId: DEMO_COMPANY_ID,
    name: 'Northstar Properties',
    email: 'ops@northstar.example',
    phone: '512-555-0150',
    projectAddress: '700 Congress Ave',
    projectCity: 'Austin',
    projectState: 'TX',
    projectZip: '78701',
    projectType: 'Retail lighting repair',
    jobDescription:
      'Troubleshoot intermittent lighting failures in a retail suite and quote repair options.',
    preferredStartDate: '2026-07-12',
    budgetMinCents: null,
    budgetMaxCents: 250000,
    status: 'viewed',
    createdAt: '2026-06-27T14:20:00.000Z',
    updatedAt: '2026-06-27T14:48:00.000Z',
  },
  {
    id: 'demo-lead-3',
    companyId: DEMO_COMPANY_ID,
    name: 'Jamie Carter',
    email: 'jamie@example.com',
    phone: '919-555-0138',
    projectAddress: '120 Oak Trail',
    projectCity: 'Raleigh',
    projectState: 'NC',
    projectZip: '27601',
    projectType: 'Kitchen circuit additions',
    jobDescription:
      'Add dedicated appliance circuits as part of a kitchen update and coordinate inspection timing.',
    preferredStartDate: '2026-07-15',
    budgetMinCents: 250000,
    budgetMaxCents: 1000000,
    status: 'responded',
    createdAt: '2026-06-26T16:00:00.000Z',
    updatedAt: '2026-06-27T10:24:00.000Z',
  },
]

const demoBuyerQuotes = demoCompanyLeads.map((lead) => ({
  ...lead,
  buyerId: 'demo-buyer',
  name: 'Jordan Lee',
}))

const demoBuyerProposals: ProposalSummary[] = [
  {
    id: 'demo-proposal-1',
    quoteRequestId: 'demo-lead-3',
    companyId: DEMO_COMPANY_ID,
    companyName: 'Lakefront Electric Co.',
    title: 'Kitchen circuit additions',
    summary:
      'Install two dedicated 20A appliance circuits, update labeling, and coordinate one inspection window.',
    subtotalCents: 385000,
    priceType: 'fixed',
    priceMinCents: 385000,
    priceMaxCents: 385000,
    assumptions: 'Drywall repair and appliance installation are excluded.',
    validUntil: '2026-07-20',
    notes: 'We can schedule after the cabinet layout is confirmed.',
    status: 'sent',
    sentAt: '2026-06-27T10:24:00.000Z',
    projectType: 'Kitchen circuit additions',
    projectCity: 'Raleigh',
    projectState: 'NC',
  },
]

export function DashboardPage() {
  if (appConfig.clerkPublishableKey) {
    return <AuthenticatedBuyerDashboardPage />
  }

  return <BuyerDashboardWorkspace demoUser="demo_buyer" />
}

function AuthenticatedBuyerDashboardPage() {
  const { getToken } = useAuth()
  return <BuyerDashboardWorkspace getToken={getToken} />
}

function BuyerDashboardWorkspace({
  demoUser,
  getToken,
}: {
  demoUser?: string
  getToken?: () => Promise<string | null>
}) {
  const queryClient = useQueryClient()
  const authOptions = async () => ({
    authToken: getToken ? await getToken() : null,
    demoUser,
  })
  const quotesQuery = useQuery({
    queryKey: ['buyer-quotes'],
    queryFn: async () =>
      apiRequest<QuoteSummary[]>('/quotes?scope=buyer', undefined, await authOptions()),
    retry: false,
  })
  const proposalsQuery = useQuery({
    queryKey: ['buyer-proposals'],
    queryFn: async () =>
      apiRequest<ProposalSummary[]>('/proposals?scope=buyer', undefined, await authOptions()),
    retry: false,
  })
  const proposalAction = useMutation({
    mutationFn: async ({
      proposalId,
      action,
    }: {
      proposalId: string
      action: 'accept' | 'decline'
    }) =>
      apiRequest<{ status: string; jobId?: string }>(
        `/proposals/${proposalId}/${action}`,
        { method: 'POST' },
        await authOptions(),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['buyer-proposals'] })
      void queryClient.invalidateQueries({ queryKey: ['buyer-quotes'] })
    },
  })
  const quotes = quotesQuery.data ?? demoBuyerQuotes
  const proposals = proposalsQuery.data ?? demoBuyerProposals
  const openRequests = quotes.filter((quote) => !['declined', 'converted'].includes(quote.status))
  const sentProposals = proposals.filter((proposal) => proposal.status === 'sent')

  return (
    <DashboardShell
      title="Buyer dashboard"
      subtitle="Review quote requests, contractor proposals, and accepted work."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open requests"
          value={String(openRequests.length)}
          hint="Awaiting contractor response"
        />
        <MetricCard
          label="Proposals"
          value={String(sentProposals.length)}
          hint="Ready for review"
        />
        {buyerMetrics.slice(2).map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Proposal review</h2>
            <Link to="/browse" className="text-sm font-bold text-slate-600">
              Find contractors
            </Link>
          </div>
          <div className="mt-5 grid gap-4">
            {proposals.map((proposal) => (
              <BuyerProposalCard
                key={proposal.id}
                proposal={proposal}
                disabled={proposalAction.isPending}
                onAction={(action) => proposalAction.mutate({ proposalId: proposal.id, action })}
              />
            ))}
            {proposals.length === 0 ? (
              <p className="rounded-lg border border-slate-200 p-5 text-sm font-semibold text-slate-600">
                No proposals are ready for review yet.
              </p>
            ) : null}
          </div>
          {proposalAction.error ? (
            <p className="mt-4 text-sm font-semibold text-red-700" role="alert">
              {proposalAction.error instanceof ApiError
                ? proposalAction.error.message
                : 'The proposal action could not be completed.'}
            </p>
          ) : null}
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-black">Submitted requests</h2>
          <div className="mt-5 grid gap-5">
            {quotes.map((quote) => (
              <div key={quote.id} className="flex gap-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-amber-400" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{quote.projectType}</p>
                    <QuoteStatusBadge status={quote.status} />
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {quote.projectCity}, {quote.projectState} - {timingLabel(quote)}
                  </p>
                </div>
              </div>
            ))}
            {quotes.length === 0 ? (
              <p className="text-sm font-semibold text-slate-600">No quote requests submitted.</p>
            ) : null}
          </div>
          {(quotesQuery.isError || proposalsQuery.isError) && !getToken ? (
            <p className="mt-5 text-xs font-semibold text-amber-800">
              Showing demo lead-flow records.
            </p>
          ) : null}
        </Card>
      </div>
    </DashboardShell>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold text-emerald-700">{hint}</p>
    </Card>
  )
}

export function CompanyDashboardPage() {
  return (
    <DashboardShell
      title="Company command center"
      subtitle="Lead, job, and billing activity for Lakefront Electric Co."
      action={
        <Button>
          <Plus size={18} /> New service
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {companyMetrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <p className="text-sm font-semibold text-slate-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-black">{metric.value}</p>
            <p className="mt-2 text-xs font-semibold text-slate-600">{metric.hint}</p>
          </Card>
        ))}
      </div>
      <CompanyOnboardingPanel />
      <CompanyLeadInboxPanel />
    </DashboardShell>
  )
}

function CompanyOnboardingPanel() {
  if (appConfig.clerkPublishableKey) {
    return <AuthenticatedCompanyOnboardingPanel />
  }

  return (
    <CompanyOnboardingWorkspace initialCompanyId={DEMO_COMPANY_ID} demoUser="demo_contractor" />
  )
}

function AuthenticatedCompanyOnboardingPanel() {
  const { getToken, isLoaded } = useAuth()
  const authOptions = async () => ({
    authToken: await getToken(),
  })
  const meQuery = useQuery({
    queryKey: ['me'],
    enabled: isLoaded,
    queryFn: async () => apiRequest<MeResponse>('/me', undefined, await authOptions()),
    retry: false,
  })
  const companyMembership =
    meQuery.data?.memberships.find((membership) => membership.role === 'company_admin') ?? null
  const errorMessage =
    meQuery.error instanceof ApiError
      ? meQuery.error.message
      : meQuery.error
        ? 'Your workspace could not be loaded.'
        : null

  if (!isLoaded || meQuery.isLoading) {
    return <OnboardingStatusCard message="Loading company profile." />
  }

  if (errorMessage) {
    return <OnboardingStatusCard message={errorMessage} tone="error" />
  }

  return (
    <CompanyOnboardingWorkspace
      initialCompanyId={companyMembership?.companyId ?? null}
      getToken={getToken}
    />
  )
}

function blankOnboardingDraft(): CompanyOnboardingDraft {
  return {
    name: '',
    description: '',
    licenseNumber: '',
    website: '',
    phone: '',
    email: '',
    city: '',
    state: 'IL',
    zip: '',
    serviceRadiusMiles: 25,
    serviceStates: [],
    serviceCategoryIds: [],
    status: 'draft',
  }
}

function profileToDraft(profile: CompanyOnboardingProfile): CompanyOnboardingDraft {
  return {
    name: profile.name,
    description: profile.description,
    licenseNumber: profile.licenseNumber ?? '',
    website: profile.website ?? '',
    phone: profile.phone,
    email: profile.email,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    serviceRadiusMiles: profile.serviceRadiusMiles,
    serviceStates: profile.serviceStates,
    serviceCategoryIds: profile.serviceCategoryIds,
    status: profile.status,
  }
}

function companyPayload(draft: CompanyOnboardingDraft) {
  return {
    name: draft.name,
    description: draft.description,
    licenseNumber: draft.licenseNumber || undefined,
    website: draft.website || undefined,
    phone: draft.phone,
    email: draft.email,
    city: draft.city,
    state: draft.state,
    zip: draft.zip,
    serviceRadiusMiles: Number(draft.serviceRadiusMiles),
    serviceStates: draft.serviceStates,
    serviceCategoryIds: draft.serviceCategoryIds,
  }
}

function CompanyOnboardingWorkspace({
  initialCompanyId,
  demoUser,
  getToken,
}: {
  initialCompanyId: string | null
  demoUser?: string
  getToken?: () => Promise<string | null>
}) {
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null)
  const companyId = createdCompanyId ?? initialCompanyId
  const authOptions = async () => ({
    authToken: getToken ? await getToken() : null,
    demoUser,
  })
  const categoriesQuery = useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => apiRequest<ServiceCategory[]>('/service-categories'),
    retry: false,
  })
  const profileQuery = useQuery({
    queryKey: ['company-onboarding', companyId],
    enabled: Boolean(companyId),
    queryFn: async () =>
      apiRequest<CompanyOnboardingProfile>(
        `/companies/${companyId}/onboarding`,
        undefined,
        await authOptions(),
      ),
    retry: false,
  })

  if (companyId && profileQuery.isLoading) {
    return <OnboardingStatusCard message="Loading company profile." />
  }

  const initialDraft = profileQuery.data
    ? profileToDraft(profileQuery.data)
    : blankOnboardingDraft()
  const formKey = profileQuery.data
    ? `${companyId}:${profileQuery.data.updatedAt ?? profileQuery.data.status}`
    : (companyId ?? 'new-company')

  return (
    <CompanyOnboardingEditor
      key={formKey}
      companyId={companyId}
      categories={categoriesQuery.data ?? []}
      initialDraft={initialDraft}
      loadError={profileQuery.error ?? categoriesQuery.error}
      setCreatedCompanyId={setCreatedCompanyId}
      demoUser={demoUser}
      getToken={getToken}
    />
  )
}

function CompanyOnboardingEditor({
  companyId,
  categories,
  initialDraft,
  loadError,
  setCreatedCompanyId,
  demoUser,
  getToken,
}: {
  companyId: string | null
  categories: ServiceCategory[]
  initialDraft: CompanyOnboardingDraft
  loadError: unknown
  setCreatedCompanyId: (companyId: string) => void
  demoUser?: string
  getToken?: () => Promise<string | null>
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<CompanyOnboardingDraft>(() => initialDraft)
  const authOptions = async () => ({
    authToken: getToken ? await getToken() : null,
    demoUser,
  })

  const saveMutation = useMutation({
    mutationFn: async () =>
      apiRequest<CompanyOnboardingSaveResponse>(
        companyId ? `/companies/${companyId}/onboarding` : '/companies',
        {
          method: companyId ? 'PATCH' : 'POST',
          body: JSON.stringify(companyPayload(draft)),
        },
        await authOptions(),
      ),
    onSuccess: (data) => {
      if (!companyId) {
        setCreatedCompanyId(data.id)
      }
      setDraft((current) => ({
        ...current,
        status: data.status,
        serviceCategoryIds: data.serviceCategoryIds ?? current.serviceCategoryIds,
        serviceStates: data.serviceStates ?? current.serviceStates,
      }))
      void queryClient.invalidateQueries({ queryKey: ['company-onboarding', data.id] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Save the draft before submitting.')
      return apiRequest<{ id: string; status: string }>(
        `/companies/${companyId}/submit-verification`,
        { method: 'POST' },
        await authOptions(),
      )
    },
    onSuccess: (data) => {
      setDraft((current) => ({ ...current, status: data.status }))
      void queryClient.invalidateQueries({ queryKey: ['company-onboarding', data.id] })
    },
  })

  const updateDraft = <Key extends keyof CompanyOnboardingDraft>(
    key: Key,
    value: CompanyOnboardingDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }))
  const toggleState = (code: string) => {
    setDraft((current) => ({
      ...current,
      serviceStates: current.serviceStates.includes(code)
        ? current.serviceStates.filter((state) => state !== code)
        : [...current.serviceStates, code].sort(),
    }))
  }
  const toggleCategory = (id: string) => {
    setDraft((current) => ({
      ...current,
      serviceCategoryIds: current.serviceCategoryIds.includes(id)
        ? current.serviceCategoryIds.filter((categoryId) => categoryId !== id)
        : [...current.serviceCategoryIds, id],
    }))
  }
  const error = saveMutation.error ?? submitMutation.error ?? loadError
  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error
        ? 'The company profile could not be saved.'
        : null
  const saving = saveMutation.isPending || submitMutation.isPending

  return (
    <form
      className="mt-7"
      onSubmit={(event) => {
        event.preventDefault()
        saveMutation.mutate()
      }}
    >
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Building2 size={20} /> Company onboarding
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={draft.status} />
              {saveMutation.isSuccess ? (
                <span className="text-sm font-semibold text-emerald-700">Draft saved.</span>
              ) : null}
              {submitMutation.isSuccess || draft.status === 'pending' ? (
                <span className="text-sm font-semibold text-emerald-700">
                  Submitted for verification.
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="gap-2" disabled={saving}>
              {saveMutation.isPending ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Save size={17} />
              )}
              Save draft
            </Button>
            <SecondaryButton
              className="gap-2"
              disabled={!companyId || saving || draft.status === 'pending'}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <BadgeCheck size={17} />
              )}
              Submit for review
            </SecondaryButton>
          </div>
        </div>

        <div className="mt-6 grid gap-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="company-name" label="Business name">
              <input
                id="company-name"
                className="input"
                value={draft.name}
                onChange={(event) => updateDraft('name', event.target.value)}
              />
            </Field>
            <Field id="company-email" label="Contact email">
              <input
                id="company-email"
                type="email"
                className="input"
                value={draft.email}
                onChange={(event) => updateDraft('email', event.target.value)}
              />
            </Field>
            <Field id="company-phone" label="Contact phone">
              <input
                id="company-phone"
                className="input"
                value={draft.phone}
                onChange={(event) => updateDraft('phone', event.target.value)}
              />
            </Field>
            <Field id="company-website" label="Website">
              <input
                id="company-website"
                type="url"
                className="input"
                value={draft.website}
                onChange={(event) => updateDraft('website', event.target.value)}
              />
            </Field>
            <Field id="company-license" label="License number">
              <input
                id="company-license"
                className="input"
                value={draft.licenseNumber}
                onChange={(event) => updateDraft('licenseNumber', event.target.value)}
              />
            </Field>
            <Field id="company-radius" label="Service radius">
              <input
                id="company-radius"
                type="number"
                min={1}
                max={150}
                className="input"
                value={draft.serviceRadiusMiles}
                onChange={(event) => updateDraft('serviceRadiusMiles', Number(event.target.value))}
              />
            </Field>
            <Field id="company-city" label="City">
              <input
                id="company-city"
                className="input"
                value={draft.city}
                onChange={(event) => updateDraft('city', event.target.value)}
              />
            </Field>
            <Field id="company-state" label="State">
              <select
                id="company-state"
                className="input"
                value={draft.state}
                onChange={(event) => updateDraft('state', event.target.value)}
              >
                {US_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="company-zip" label="ZIP code">
              <input
                id="company-zip"
                className="input"
                inputMode="numeric"
                value={draft.zip}
                onChange={(event) => updateDraft('zip', event.target.value)}
              />
            </Field>
            <Field id="company-description" label="Description">
              <textarea
                id="company-description"
                className="input min-h-32 resize-y md:col-span-2"
                value={draft.description}
                onChange={(event) => updateDraft('description', event.target.value)}
              />
            </Field>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-slate-800">Service categories</legend>
            <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300 accent-amber-500"
                    checked={draft.serviceCategoryIds.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                  />
                  <span>{category.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-slate-800">Service states</legend>
            <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-4">
              {US_STATES.map((state) => (
                <label
                  key={state.code}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300 accent-amber-500"
                    checked={draft.serviceStates.includes(state.code)}
                    onChange={() => toggleState(state.code)}
                  />
                  <span>
                    {state.name} ({state.code})
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {errorMessage ? (
          <p className="mt-4 text-sm font-semibold text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </Card>
    </form>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'verified':
      return (
        <Badge tone="success">
          <BadgeCheck className="mr-1 inline" size={14} /> Verified
        </Badge>
      )
    case 'pending':
      return <Badge tone="warning">Pending review</Badge>
    case 'rejected':
      return (
        <Badge tone="warning">
          <XCircle className="mr-1 inline" size={14} /> Changes requested
        </Badge>
      )
    case 'suspended':
      return (
        <Badge tone="neutral">
          <Ban className="mr-1 inline" size={14} /> Suspended
        </Badge>
      )
    default:
      return <Badge tone="neutral">Draft</Badge>
  }
}

function OnboardingStatusCard({
  message,
  tone = 'neutral',
}: {
  message: string
  tone?: 'neutral' | 'error'
}) {
  return (
    <Card className="mt-7 p-5">
      <h2 className="flex items-center gap-2 text-xl font-black">
        <Building2 size={20} /> Company onboarding
      </h2>
      <p
        className={`mt-3 text-sm font-semibold ${tone === 'error' ? 'text-red-700' : 'text-slate-600'}`}
      >
        {message}
      </p>
    </Card>
  )
}

export function LeadsPage() {
  return (
    <DashboardShell
      title="Lead inbox"
      subtitle="Review project details, reply, and prepare proposals."
    >
      <CompanyLeadInboxPanel />
    </DashboardShell>
  )
}

function CompanyLeadInboxPanel() {
  if (appConfig.clerkPublishableKey) {
    return <AuthenticatedCompanyLeadInbox />
  }

  return <CompanyLeadInboxWorkspace demoUser="demo_contractor" />
}

function AuthenticatedCompanyLeadInbox() {
  const { getToken } = useAuth()
  return <CompanyLeadInboxWorkspace getToken={getToken} />
}

function CompanyLeadInboxWorkspace({
  demoUser,
  getToken,
}: {
  demoUser?: string
  getToken?: () => Promise<string | null>
}) {
  const queryClient = useQueryClient()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const authOptions = async () => ({
    authToken: getToken ? await getToken() : null,
    demoUser,
  })
  const leadsQuery = useQuery({
    queryKey: ['company-leads'],
    queryFn: async () =>
      apiRequest<QuoteSummary[]>('/quotes?scope=company', undefined, await authOptions()),
    retry: false,
  })
  const statusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: QuoteStatus }) =>
      apiRequest<{ id: string; status: QuoteStatus }>(
        `/quotes/${quoteId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
        await authOptions(),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['company-leads'] })
    },
  })
  const proposalMutation = useMutation({
    mutationFn: async ({ quote, draft }: { quote: QuoteSummary; draft: ProposalDraft }) => {
      const proposal = await apiRequest<{ id: string; status: ProposalStatus }>(
        '/proposals',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify(proposalPayload(quote, draft)),
        },
        await authOptions(),
      )
      return apiRequest<{ id: string; status: ProposalStatus }>(
        `/proposals/${proposal.id}/send`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: '{}',
        },
        await authOptions(),
      )
    },
    onSuccess: () => {
      setSentMessage('Proposal sent.')
      void queryClient.invalidateQueries({ queryKey: ['company-leads'] })
      void queryClient.invalidateQueries({ queryKey: ['buyer-proposals'] })
    },
  })
  const leads = leadsQuery.data ?? demoCompanyLeads
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? leads[0] ?? null

  return (
    <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-xl font-black">Lead inbox</h2>
            <p className="mt-1 text-sm text-slate-500">Incoming buyer requests for this company.</p>
          </div>
          <Badge tone="warning">{leads.filter((lead) => lead.status === 'new').length} new</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-220 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Buyer</th>
                <th className="px-5 py-3">Timing</th>
                <th className="px-5 py-3">Budget</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-slate-100 align-top">
                  <td className="px-5 py-4">
                    <p className="font-bold">{lead.projectType}</p>
                    <p className="mt-1 max-w-md text-sm leading-5 text-slate-600">
                      {lead.projectCity}, {lead.projectState} - {lead.jobDescription}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold">{lead.name}</p>
                    <p className="mt-1 text-slate-500">{lead.email}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{timingLabel(lead)}</td>
                  <td className="px-5 py-4 text-slate-600">{budgetLabel(lead)}</td>
                  <td className="px-5 py-4">
                    <QuoteStatusBadge status={lead.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <IconButton
                        label={`Mark ${lead.projectType} viewed`}
                        disabled={statusMutation.isPending || lead.status !== 'new'}
                        onClick={() =>
                          statusMutation.mutate({ quoteId: lead.id, status: 'viewed' })
                        }
                      >
                        <Eye size={16} />
                      </IconButton>
                      <IconButton
                        label={`Mark ${lead.projectType} ready for proposal`}
                        disabled={
                          statusMutation.isPending || !['new', 'viewed'].includes(lead.status)
                        }
                        onClick={() =>
                          statusMutation.mutate({
                            quoteId: lead.id,
                            status: 'ready_for_proposal',
                          })
                        }
                      >
                        <ClipboardCheck size={16} />
                      </IconButton>
                      <IconButton
                        label={`Decline ${lead.projectType}`}
                        disabled={
                          statusMutation.isPending ||
                          ['responded', 'declined', 'converted'].includes(lead.status)
                        }
                        onClick={() =>
                          statusMutation.mutate({ quoteId: lead.id, status: 'declined' })
                        }
                      >
                        <XCircle size={16} />
                      </IconButton>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setSelectedLeadId(lead.id)
                          setSentMessage(null)
                        }}
                      >
                        Proposal
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquareText className="mx-auto text-slate-500" />
            <p className="mt-3 font-bold">No incoming quote requests</p>
          </div>
        ) : null}
        {statusMutation.error ? (
          <p className="px-5 pb-5 text-sm font-semibold text-red-700" role="alert">
            {statusMutation.error instanceof ApiError
              ? statusMutation.error.message
              : 'The lead action could not be completed.'}
          </p>
        ) : null}
      </Card>

      <ProposalComposer
        lead={selectedLead}
        pending={proposalMutation.isPending}
        sentMessage={sentMessage}
        error={proposalMutation.error}
        onSubmit={(quote, draft) => proposalMutation.mutate({ quote, draft })}
      />
      {leadsQuery.isError && !getToken ? (
        <p className="text-xs font-semibold text-amber-800 xl:col-span-2">
          Showing demo lead records.
        </p>
      ) : null}
    </div>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function ProposalComposer({
  lead,
  pending,
  sentMessage,
  error,
  onSubmit,
}: {
  lead: QuoteSummary | null
  pending: boolean
  sentMessage: string | null
  error: unknown
  onSubmit: (lead: QuoteSummary, draft: ProposalDraft) => void
}) {
  const [draft, setDraft] = useState<ProposalDraft>(() => blankProposalDraft())
  const updateDraft = <Key extends keyof ProposalDraft>(key: Key, value: ProposalDraft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  if (!lead) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-black">Proposal</h2>
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Select a lead to prepare a response.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">Proposal</h2>
          <p className="mt-1 text-sm text-slate-500">{lead.projectType}</p>
        </div>
        <QuoteStatusBadge status={lead.status} />
      </div>
      <form
        className="mt-5 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(lead, draft)
        }}
      >
        <Field id="proposal-title" label="Title">
          <input
            id="proposal-title"
            className="input"
            value={draft.title}
            onChange={(event) => updateDraft('title', event.target.value)}
          />
        </Field>
        <Field id="proposal-summary" label="Scope summary">
          <textarea
            id="proposal-summary"
            className="input min-h-28 resize-y"
            value={draft.summary}
            onChange={(event) => updateDraft('summary', event.target.value)}
          />
        </Field>
        <Field id="proposal-price-type" label="Estimate type">
          <select
            id="proposal-price-type"
            className="input"
            value={draft.priceType}
            onChange={(event) => updateDraft('priceType', event.target.value as 'fixed' | 'range')}
          >
            <option value="fixed">Fixed estimate</option>
            <option value="range">Price range</option>
          </select>
        </Field>
        {draft.priceType === 'fixed' ? (
          <Field id="proposal-fixed" label="Fixed estimate">
            <input
              id="proposal-fixed"
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={draft.fixedAmount}
              onChange={(event) => updateDraft('fixedAmount', event.target.value)}
            />
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="proposal-min" label="Range low">
              <input
                id="proposal-min"
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={draft.minAmount}
                onChange={(event) => updateDraft('minAmount', event.target.value)}
              />
            </Field>
            <Field id="proposal-max" label="Range high">
              <input
                id="proposal-max"
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={draft.maxAmount}
                onChange={(event) => updateDraft('maxAmount', event.target.value)}
              />
            </Field>
          </div>
        )}
        <Field id="proposal-assumptions" label="Assumptions">
          <textarea
            id="proposal-assumptions"
            className="input min-h-24 resize-y"
            value={draft.assumptions}
            onChange={(event) => updateDraft('assumptions', event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="proposal-valid-until" label="Expiration date">
            <input
              id="proposal-valid-until"
              className="input"
              type="date"
              value={draft.validUntil}
              onChange={(event) => updateDraft('validUntil', event.target.value)}
            />
          </Field>
          <Field id="proposal-notes" label="Notes">
            <input
              id="proposal-notes"
              className="input"
              value={draft.notes}
              onChange={(event) => updateDraft('notes', event.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" className="gap-2" disabled={pending || lead.status === 'declined'}>
          {pending ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
          Send proposal
        </Button>
      </form>
      {sentMessage ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={17} /> {sentMessage}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm font-semibold text-red-700" role="alert">
          {error instanceof ApiError ? error.message : 'The proposal could not be sent.'}
        </p>
      ) : null}
    </Card>
  )
}

function BuyerProposalCard({
  proposal,
  disabled,
  onAction,
}: {
  proposal: ProposalSummary
  disabled: boolean
  onAction: (action: 'accept' | 'decline') => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">{proposal.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {proposal.companyName ?? 'Contractor'} - {proposal.projectCity}, {proposal.projectState}
          </p>
        </div>
        <ProposalStatusBadge status={proposal.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1 font-black text-slate-900">
          <CircleDollarSign size={17} /> {proposalPriceLabel(proposal)}
        </span>
        {proposal.validUntil ? (
          <span className="font-semibold text-slate-500">Expires {proposal.validUntil}</span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{proposal.summary}</p>
      {proposal.assumptions ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          <span className="font-bold text-slate-800">Assumptions:</span> {proposal.assumptions}
        </p>
      ) : null}
      {proposal.notes ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">
          <span className="font-bold text-slate-800">Notes:</span> {proposal.notes}
        </p>
      ) : null}
      {proposal.status === 'sent' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="gap-2" disabled={disabled} onClick={() => onAction('accept')}>
            <CheckCircle2 size={17} /> Accept
          </Button>
          <SecondaryButton
            className="gap-2"
            disabled={disabled}
            onClick={() => onAction('decline')}
          >
            <XCircle size={17} /> Decline
          </SecondaryButton>
        </div>
      ) : null}
    </div>
  )
}

function blankProposalDraft(): ProposalDraft {
  return {
    title: '',
    summary: '',
    priceType: 'fixed',
    fixedAmount: '',
    minAmount: '',
    maxAmount: '',
    assumptions: '',
    validUntil: '',
    notes: '',
  }
}

function proposalPayload(quote: QuoteSummary, draft: ProposalDraft) {
  const fixedCents = dollarsToCents(draft.fixedAmount)
  const minCents = dollarsToCents(draft.minAmount)
  const maxCents = dollarsToCents(draft.maxAmount)
  return {
    quoteRequestId: quote.id,
    title: draft.title || quote.projectType,
    summary: draft.summary,
    priceType: draft.priceType,
    priceMinCents: draft.priceType === 'range' ? minCents : fixedCents,
    priceMaxCents: draft.priceType === 'range' ? maxCents : fixedCents,
    assumptions: draft.assumptions || undefined,
    validUntil: draft.validUntil || undefined,
    notes: draft.notes || undefined,
  }
}

function dollarsToCents(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined
}

function timingLabel(quote: Pick<QuoteSummary, 'preferredStartDate'>) {
  return quote.preferredStartDate ? `Requested ${quote.preferredStartDate}` : 'Timing flexible'
}

function budgetLabel(quote: Pick<QuoteSummary, 'budgetMinCents' | 'budgetMaxCents'>) {
  if (quote.budgetMinCents != null && quote.budgetMaxCents != null) {
    return `${formatMoney(quote.budgetMinCents)}-${formatMoney(quote.budgetMaxCents)}`
  }
  if (quote.budgetMinCents != null) return `${formatMoney(quote.budgetMinCents)}+`
  if (quote.budgetMaxCents != null) return `Up to ${formatMoney(quote.budgetMaxCents)}`
  return 'Not specified'
}

function proposalPriceLabel(proposal: ProposalSummary) {
  const min = proposal.priceMinCents ?? proposal.subtotalCents
  const max = proposal.priceMaxCents ?? proposal.subtotalCents
  if (proposal.priceType === 'range' && min !== max) {
    return `${formatMoney(min)}-${formatMoney(max)}`
  }
  return formatMoney(max)
}

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const labels: Record<QuoteStatus, string> = {
    new: 'New',
    viewed: 'Viewed',
    ready_for_proposal: 'Ready for proposal',
    responded: 'Proposal sent',
    accepted: 'Accepted',
    declined: 'Declined',
    expired: 'Expired',
    converted: 'Job ready',
  }
  return (
    <Badge
      tone={
        status === 'new'
          ? 'warning'
          : ['responded', 'converted'].includes(status)
            ? 'success'
            : 'neutral'
      }
    >
      {labels[status]}
    </Badge>
  )
}

function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const labels: Record<ProposalStatus, string> = {
    draft: 'Draft',
    sent: 'Sent',
    accepted: 'Accepted',
    declined: 'Declined',
    expired: 'Expired',
    withdrawn: 'Withdrawn',
  }
  return (
    <Badge tone={status === 'accepted' ? 'success' : status === 'sent' ? 'warning' : 'neutral'}>
      {labels[status]}
    </Badge>
  )
}

export function JobsPage() {
  return (
    <ListPage
      title="Jobs"
      subtitle="Track accepted work from scheduling through closeout."
      items={[
        ['Kitchen remodel', 'In progress - 62% complete', 'Updated today'],
        ['Panel replacement', 'Scheduled - Jun 22', 'Updated yesterday'],
        ['Rooftop unit repair', 'Awaiting invoice', 'Updated Jun 12'],
      ]}
      icon={<CalendarDays />}
    />
  )
}
export function InvoicesPage() {
  return (
    <DashboardShell
      title="Invoices"
      subtitle="Draft, send, and track itemized construction invoices."
      action={
        <Link to="/dashboard/invoices/new">
          <Button>
            <Plus size={18} /> New invoice
          </Button>
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="mt-2 text-3xl font-black">{formatMoney(428000)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Paid this month</p>
          <p className="mt-2 text-3xl font-black">{formatMoney(1265000)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Drafts</p>
          <p className="mt-2 text-3xl font-black">4</p>
        </Card>
      </div>
      <ListRows
        items={[
          ['INV-2026-0048 - Prairie & Stone Builders', '$4,280.00 - Due Jun 25', 'Sent'],
          ['INV-2026-0047 - Lakefront Electric', '$1,940.00 - Paid Jun 10', 'Paid'],
          ['Draft - Rooftop unit repair', '$2,650.00 estimated', 'Draft'],
        ]}
      />
    </DashboardShell>
  )
}

function ListPage({
  title,
  subtitle,
  items,
  icon,
}: {
  title: string
  subtitle: string
  items: string[][]
  icon: ReactNode
}) {
  return (
    <DashboardShell title={title} subtitle={subtitle}>
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        {icon}
        <span>
          <strong>Demo data:</strong> connect Clerk and D1 to manage live records.
        </span>
      </div>
      <ListRows items={items} />
    </DashboardShell>
  )
}
function ListRows({ items }: { items: string[][] }) {
  return (
    <Card className="mt-6 divide-y divide-slate-100">
      {items.map((item) => (
        <div key={item[0]} className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-black">{item[0]}</p>
            <p className="mt-1 text-sm text-slate-600">{item[1]}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              tone={item[2] === 'Paid' ? 'success' : item[2] === 'Sent' ? 'warning' : 'neutral'}
            >
              {item[2]}
            </Badge>
            <button
              className="rounded-lg border border-slate-200 p-2"
              aria-label={`Open ${item[0]}`}
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
        </div>
      ))}
    </Card>
  )
}

const demoPendingCompanies: AdminCompanySummary[] = [
  {
    id: 'pending-canyon',
    name: 'Canyon Masonry Group',
    description: 'Masonry repair and commercial concrete restoration awaiting review.',
    licenseNumber: 'MSN-20481',
    phone: '602-555-0101',
    email: 'hello@canyonmasonry.example',
    city: 'Phoenix',
    state: 'AZ',
    status: 'pending',
  },
  {
    id: 'pending-riverbend',
    name: 'Riverbend Plumbing Partners',
    description: 'Plumbing repair and rough-in profile awaiting verification.',
    licenseNumber: 'PLB-77192',
    phone: '512-555-0107',
    email: 'service@riverbendplumbing.example',
    city: 'Austin',
    state: 'TX',
    status: 'pending',
  },
  {
    id: 'pending-summit',
    name: 'Summit Roofing Co.',
    description: 'Roof repair and gutter profile awaiting verification.',
    licenseNumber: 'RFG-44018',
    phone: '801-555-0122',
    email: 'hello@summitroof.example',
    city: 'Salt Lake City',
    state: 'UT',
    status: 'pending',
  },
]

export function AdminPage() {
  if (appConfig.clerkPublishableKey) {
    return <AuthenticatedAdminPage />
  }

  return <AdminDashboard demoUser="demo_admin" />
}

function AuthenticatedAdminPage() {
  const { getToken } = useAuth()
  return <AdminDashboard getToken={getToken} />
}

function AdminDashboard({
  demoUser,
  getToken,
}: {
  demoUser?: string
  getToken?: () => Promise<string | null>
}) {
  const queryClient = useQueryClient()
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const authOptions = async () => ({
    authToken: getToken ? await getToken() : null,
    demoUser,
  })
  const pendingQuery = useQuery({
    queryKey: ['admin-companies-pending'],
    queryFn: async () =>
      apiRequest<AdminCompanySummary[]>('/admin/companies/pending', undefined, await authOptions()),
    retry: false,
  })
  const reviewMutation = useMutation({
    mutationFn: async ({
      companyId,
      action,
      reason,
    }: {
      companyId: string
      action: 'approve' | 'reject' | 'suspend'
      reason?: string
    }) =>
      apiRequest<{ id: string; status: string }>(
        `/admin/companies/${companyId}/${action}`,
        {
          method: 'POST',
          body: action === 'approve' ? undefined : JSON.stringify({ reason }),
        },
        await authOptions(),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-companies-pending'] })
    },
  })
  const pendingCompanies = pendingQuery.data ?? (pendingQuery.isError ? demoPendingCompanies : [])
  const reviewReason = (companyId: string) =>
    reviewNotes[companyId] || 'Additional verification details are required.'

  return (
    <DashboardShell
      title="Trust and safety"
      subtitle="Verify businesses, moderate content, and review audit activity."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <ShieldAlert className="text-amber-600" />
          <p className="mt-4 text-3xl font-black">
            {pendingQuery.isLoading ? '--' : pendingCompanies.length}
          </p>
          <p className="text-sm text-slate-500">Verification reviews</p>
        </Card>
        <Card className="p-5">
          <Clock3 className="text-slate-600" />
          <p className="mt-4 text-3xl font-black">3</p>
          <p className="text-sm text-slate-500">Open support cases</p>
        </Card>
        <Card className="p-5">
          <Star className="text-slate-600" />
          <p className="mt-4 text-3xl font-black">2</p>
          <p className="text-sm text-slate-500">Flagged reviews</p>
        </Card>
      </div>
      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">Pending companies</h2>
            {pendingQuery.isError ? (
              <p className="mt-1 text-sm font-semibold text-amber-800">
                Showing demo verification records.
              </p>
            ) : null}
          </div>
          <SecondaryButton>Open audit log</SecondaryButton>
        </div>
        {pendingQuery.isLoading ? (
          <p className="mt-5 text-sm font-semibold text-slate-600">Loading pending companies.</p>
        ) : (
          <div className="mt-5 grid gap-4">
            {pendingCompanies.map((company) => (
              <div key={company.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{company.name}</p>
                      <StatusBadge status={company.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {company.city}, {company.state} - License {company.licenseNumber || 'not set'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{company.description}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {company.email} - {company.phone}
                    </p>
                  </div>
                  <div className="grid min-w-72 gap-2">
                    <input
                      className="input min-h-10 text-sm"
                      aria-label={`Review note for ${company.name}`}
                      placeholder="Review note"
                      value={reviewNotes[company.id] ?? ''}
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [company.id]: event.target.value,
                        }))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="gap-2"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({ companyId: company.id, action: 'approve' })
                        }
                      >
                        <BadgeCheck size={17} /> Approve
                      </Button>
                      <SecondaryButton
                        className="gap-2"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            companyId: company.id,
                            action: 'reject',
                            reason: reviewReason(company.id),
                          })
                        }
                      >
                        <XCircle size={17} /> Request changes
                      </SecondaryButton>
                      <SecondaryButton
                        className="gap-2"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            companyId: company.id,
                            action: 'suspend',
                            reason: reviewReason(company.id),
                          })
                        }
                      >
                        <Ban size={17} /> Suspend
                      </SecondaryButton>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {pendingCompanies.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-6 text-center">
                <FilePenLine className="mx-auto text-slate-500" />
                <p className="mt-3 font-bold">No pending companies</p>
              </div>
            ) : null}
          </div>
        )}
        {reviewMutation.error ? (
          <p className="mt-4 text-sm font-semibold text-red-700" role="alert">
            {reviewMutation.error instanceof ApiError
              ? reviewMutation.error.message
              : 'The review action could not be completed.'}
          </p>
        ) : null}
      </Card>
    </DashboardShell>
  )
}

function DashboardShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="p-4 sm:p-7 lg:p-10">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          <p className="mt-2 text-slate-600">{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </main>
  )
}
