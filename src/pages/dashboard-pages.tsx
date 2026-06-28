import {
  ArrowUpRight,
  BadgeCheck,
  Ban,
  Building2,
  CalendarDays,
  Clock3,
  FilePenLine,
  LoaderCircle,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Star,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@clerk/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { activity, buyerMetrics, companyMetrics } from '../data/demo'
import { formatMoney } from '../../shared/money'
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

export function DashboardPage() {
  return (
    <DashboardShell
      title="Good morning, Alex"
      subtitle="Here is what needs your attention across your projects."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {buyerMetrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <p className="text-sm font-semibold text-slate-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-black">{metric.value}</p>
            <p className="mt-2 text-xs font-semibold text-emerald-700">{metric.hint}</p>
          </Card>
        ))}
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Active projects</h2>
            <Link to="/dashboard/jobs" className="text-sm font-bold text-slate-600">
              View all
            </Link>
          </div>
          <div className="mt-5 grid gap-4">
            {[
              {
                name: 'Kitchen remodel',
                company: 'Prairie & Stone Builders',
                status: 'In progress',
                progress: 62,
              },
              {
                name: 'Electrical panel replacement',
                company: 'Lakefront Electric Co.',
                status: 'Proposal received',
                progress: 25,
              },
            ].map((job) => (
              <div key={job.name} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{job.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{job.company}</p>
                  </div>
                  <Badge tone={job.status === 'In progress' ? 'success' : 'warning'}>
                    {job.status}
                  </Badge>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-black">Recent activity</h2>
          <div className="mt-5 grid gap-5">
            {activity.map((item) => (
              <div key={item.id} className="flex gap-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-amber-400" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{item.title}</p>
                    <Badge tone={item.tone}>{item.timestamp}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardShell>
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
      <Card className="mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-xl font-black">Lead inbox</h2>
            <p className="mt-1 text-sm text-slate-500">Prioritized by response time.</p>
          </div>
          <SecondaryButton>
            <Search size={17} /> Filter leads
          </SecondaryButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Buyer</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Received</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  project: '200A panel upgrade',
                  buyer: 'Morgan Lee',
                  location: 'Cleveland',
                  received: '18 min ago',
                  status: 'New',
                },
                {
                  project: 'Retail lighting repair',
                  buyer: 'Northstar Properties',
                  location: 'Austin',
                  received: '1h 12m ago',
                  status: 'Viewed',
                },
                {
                  project: 'Kitchen circuit additions',
                  buyer: 'Jamie Carter',
                  location: 'Raleigh',
                  received: 'Yesterday',
                  status: 'Proposal sent',
                },
              ].map((lead) => (
                <tr key={lead.project} className="border-t border-slate-100">
                  <td className="px-5 py-4 font-bold">{lead.project}</td>
                  <td className="px-5 py-4">{lead.buyer}</td>
                  <td className="px-5 py-4 text-slate-600">{lead.location}</td>
                  <td className="px-5 py-4 text-slate-600">{lead.received}</td>
                  <td className="px-5 py-4">
                    <Badge
                      tone={
                        lead.status === 'New'
                          ? 'warning'
                          : lead.status === 'Proposal sent'
                            ? 'success'
                            : 'neutral'
                      }
                    >
                      {lead.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <button aria-label={`Actions for ${lead.project}`}>
                      <MoreHorizontal />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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
              {submitMutation.isSuccess ? (
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
    <ListPage
      title="Lead inbox"
      subtitle="Review project details, reply, and prepare proposals."
      items={[
        ['200A panel upgrade', 'New - Cleveland', '18 minutes ago'],
        ['Retail lighting repair', 'Viewed - Austin', '1 hour ago'],
        ['Kitchen circuit additions', 'Proposal sent - Raleigh', 'Yesterday'],
      ]}
      icon={<MessageSquareText />}
    />
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
