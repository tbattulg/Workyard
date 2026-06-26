import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Star,
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
import { Badge, Button, Card, SecondaryButton } from '../components/ui'

const DEMO_COMPANY_ID = '11111111-1111-4111-8111-111111111111'

type ServiceStatesResponse = {
  id?: string
  states: string[]
  status?: string
}

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
      <CompanyServiceStatesPanel />
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
                  location: 'Lincoln Square',
                  received: '18 min ago',
                  status: 'New',
                },
                {
                  project: 'Retail lighting repair',
                  buyer: 'Northstar Properties',
                  location: 'Lakeview',
                  received: '1h 12m ago',
                  status: 'Viewed',
                },
                {
                  project: 'Kitchen circuit additions',
                  buyer: 'Jamie Carter',
                  location: 'Oak Park',
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

function CompanyServiceStatesPanel() {
  if (appConfig.clerkPublishableKey) {
    return <AuthenticatedCompanyServiceStatesPanel />
  }

  return (
    <ServiceStatesPanel
      companyId={DEMO_COMPANY_ID}
      companyName="Lakefront Electric Co."
      demoUser="demo_contractor"
    />
  )
}

function AuthenticatedCompanyServiceStatesPanel() {
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
    return <ServiceStatesStatusCard message="Loading service states." />
  }

  if (errorMessage) {
    return <ServiceStatesStatusCard message={errorMessage} tone="error" />
  }

  if (!companyMembership) {
    return <ServiceStatesStatusCard message="Company admin access is required." tone="error" />
  }

  return (
    <ServiceStatesPanel
      companyId={companyMembership.companyId}
      companyName={companyMembership.companyName}
      getToken={getToken}
    />
  )
}

function ServiceStatesPanel({
  companyId,
  companyName = 'this company',
  demoUser,
  enabled = true,
  getToken,
}: {
  companyId: string
  companyName?: string
  demoUser?: string
  enabled?: boolean
  getToken?: () => Promise<string | null>
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<{ companyId: string; states: string[] } | null>(null)
  const authOptions = async () => ({
    authToken: getToken ? await getToken() : null,
    demoUser,
  })
  const serviceStatesQuery = useQuery({
    queryKey: ['company-service-states', companyId],
    enabled,
    queryFn: async () =>
      apiRequest<ServiceStatesResponse>(
        `/companies/${companyId}/service-states`,
        undefined,
        await authOptions(),
      ),
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: async (states: string[]) =>
      apiRequest<ServiceStatesResponse>(
        `/companies/${companyId}/service-states`,
        {
          method: 'PUT',
          body: JSON.stringify({ states }),
        },
        await authOptions(),
      ),
    onSuccess: (data) => {
      setDraft({ companyId, states: data.states })
      queryClient.setQueryData(['company-service-states', companyId], data)
    },
  })

  const selectedStates =
    draft?.companyId === companyId ? draft.states : (serviceStatesQuery.data?.states ?? [])
  const toggleState = (code: string) => {
    setDraft((current) => {
      const source = current?.companyId === companyId ? current.states : selectedStates
      const states = source.includes(code)
        ? source.filter((state) => state !== code)
        : [...source, code].sort()
      return { companyId, states }
    })
  }
  const error = mutation.error ?? serviceStatesQuery.error
  const errorMessage =
    error instanceof ApiError ? error.message : error ? 'Service states could not be loaded.' : null

  return (
    <Card className="mt-7 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            <MapPin size={20} /> Service states
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Select every state where {companyName} accepts leads.
          </p>
        </div>
        <Button
          className="gap-2"
          disabled={selectedStates.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate(selectedStates)}
        >
          {mutation.isPending ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <Save size={17} />
          )}
          Save states
        </Button>
      </div>
      {serviceStatesQuery.isLoading ? (
        <p className="mt-5 text-sm text-slate-600">Loading service states.</p>
      ) : (
        <fieldset className="mt-5">
          <legend className="sr-only">Service states</legend>
          <div className="grid max-h-72 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-4">
            {US_STATES.map((state) => (
              <label
                key={state.code}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 accent-amber-500"
                  checked={selectedStates.includes(state.code)}
                  onChange={() => toggleState(state.code)}
                />
                <span>
                  {state.name} ({state.code})
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-4 min-h-5 text-sm">
        {mutation.isSuccess ? (
          <p className="font-semibold text-emerald-700">Service states saved.</p>
        ) : null}
        {errorMessage ? (
          <p className="font-semibold text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </Card>
  )
}

function ServiceStatesStatusCard({
  message,
  tone = 'neutral',
}: {
  message: string
  tone?: 'neutral' | 'error'
}) {
  return (
    <Card className="mt-7 p-5">
      <h2 className="flex items-center gap-2 text-xl font-black">
        <MapPin size={20} /> Service states
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
        ['200A panel upgrade', 'New - Lincoln Square', '18 minutes ago'],
        ['Retail lighting repair', 'Viewed - Lakeview', '1 hour ago'],
        ['Kitchen circuit additions', 'Proposal sent - Oak Park', 'Yesterday'],
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

export function AdminPage() {
  return (
    <DashboardShell
      title="Trust and safety"
      subtitle="Verify businesses, moderate content, and review audit activity."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <ShieldAlert className="text-amber-600" />
          <p className="mt-4 text-3xl font-black">6</p>
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Pending companies</h2>
          <SecondaryButton>Open audit log</SecondaryButton>
        </div>
        <div className="mt-5 grid gap-4">
          {['Chicago Masonry Group', 'Windy City Plumbing Partners', 'West Side Roofing Co.'].map(
            (name) => (
              <div
                key={name}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <p className="font-bold">{name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Business details and credentials awaiting review
                  </p>
                </div>
                <div className="flex gap-2">
                  <SecondaryButton>Review</SecondaryButton>
                  <Button>Approve</Button>
                </div>
              </div>
            ),
          )}
        </div>
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
