import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  FileText,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { CompanySummary } from '../../shared/domain'
import { US_STATES, stateNameForCode } from '../../shared/us-states'
import { demoCompanies, demoServicesBySlug } from '../data/demo'
import { apiRequest } from '../lib/api'
import { Badge, Button, Card, SecondaryButton } from '../components/ui'

const categories = ['Electrical', 'Plumbing', 'HVAC', 'Remodeling', 'Roofing', 'Carpentry']

export function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,#fbbf24_1px,transparent_1px),linear-gradient(to_bottom,#fbbf24_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-28">
          <div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Find the right contractor. Keep the whole job clear.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Discover verified trade businesses, request a detailed quote, follow the work, and
              keep invoices in one place.
            </p>
            <form
              action="/browse"
              className="mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl bg-white p-3 shadow-2xl sm:flex-row"
            >
              <label className="sr-only" htmlFor="home-search">
                What service do you need?
              </label>
              <div className="flex flex-1 items-center gap-3 px-3 text-slate-600">
                <Search aria-hidden="true" />
                <input
                  id="home-search"
                  name="q"
                  className="min-h-12 w-full text-slate-950 outline-none"
                  placeholder="Electrical, roofing, remodeling..."
                />
              </div>
              <Button type="submit" className="sm:px-7">
                Search contractors
              </Button>
            </form>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <ShieldCheck className="text-amber-400" size={18} /> Manual business review
              </span>
              <span className="flex items-center gap-2">
                <FileText className="text-amber-400" size={18} /> Itemized job invoices
              </span>
            </div>
          </div>
          <Card className="self-end border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-300">
              A better project request
            </p>
            <div className="mt-5 grid gap-4">
              {[
                'Project address and scope',
                'Preferred timing and budget',
                'Clear constraints and site details',
                'One organized conversation',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-slate-800 p-4">
                  <CheckCircle2 className="shrink-0 text-emerald-400" />
                  <span className="font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-bold text-amber-700">Popular trades</p>
            <h2 className="mt-2 text-3xl font-black">Start with the work you need</h2>
          </div>
          <Link to="/browse" className="hidden font-bold text-slate-700 sm:block">
            View all <ArrowRight className="inline" size={18} />
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <Link
              key={category}
              to={`/browse?category=${category}`}
              className="group flex min-h-32 items-end justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-md"
            >
              <div>
                <span className="text-sm font-semibold text-slate-500">0{index + 1}</span>
                <h3 className="mt-2 text-xl font-black">{category}</h3>
              </div>
              <ArrowRight className="text-slate-400 group-hover:text-amber-600" />
            </Link>
          ))}
        </div>
      </section>
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: 'Discover',
                text: 'Search verified companies by service and state.',
              },
              {
                icon: MessageSquareText,
                title: 'Request and compare',
                text: 'Send complete project details and review a clear proposal.',
              },
              {
                icon: FileText,
                title: 'Manage and invoice',
                text: 'Keep updates, documents, change orders, and invoices tied to the job.',
              },
            ].map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="rounded-2xl bg-slate-50 p-7">
                <span className="grid size-12 place-items-center rounded-xl bg-slate-950 text-amber-400">
                  <Icon />
                </span>
                <p className="mt-5 text-sm font-bold text-amber-700">Step {index + 1}</p>
                <h3 className="mt-1 text-xl font-black">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export function BrowsePage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const state = params.get('state') ?? ''
  const filteredDemo = demoCompanies.filter(
    (company) =>
      (!query ||
        `${company.name} ${company.description} ${company.categories.join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!category || company.categories.includes(category)) &&
      (!state || (company.serviceStates ?? [company.state]).includes(state)),
  )
  const search = new URLSearchParams()
  if (query) search.set('q', query)
  if (category) search.set('category', category)
  if (state) search.set('state', state)
  const companiesQuery = useQuery({
    queryKey: ['companies', query, category, state],
    queryFn: () => apiRequest<CompanySummary[]>(`/companies?${search.toString()}`),
    retry: false,
  })
  const liveCompanies = companiesQuery.data
  const useDemoFallback = liveCompanies?.length === 0 && filteredDemo.length > 0
  const filtered = useDemoFallback ? filteredDemo : (liveCompanies ?? [])
  const emptyLocation = state ? stateNameForCode(state) : 'those filters'
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <Badge tone="warning">U.S. marketplace</Badge>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Browse verified contractors</h1>
        <p className="mt-3 text-lg text-slate-600">
          Search by trade, project need, or service area.
        </p>
      </div>
      <form
        className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_190px_180px_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const q = form.get('q')
          const selectedCategory = form.get('category')
          const selectedState = form.get('state')
          const next = new URLSearchParams()
          if (typeof q === 'string' && q) next.set('q', q)
          if (typeof selectedCategory === 'string' && selectedCategory)
            next.set('category', selectedCategory)
          if (typeof selectedState === 'string' && selectedState) next.set('state', selectedState)
          setParams(next)
        }}
      >
        <input
          name="q"
          defaultValue={params.get('q') ?? ''}
          className="min-h-12 rounded-lg border border-slate-300 px-4"
          aria-label="Search contractors"
          placeholder="Search contractors or services"
        />
        <select
          name="category"
          defaultValue={category}
          className="min-h-12 rounded-lg border border-slate-300 px-4"
          aria-label="Filter by category"
        >
          <option value="">All trades</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          name="state"
          defaultValue={state}
          className="min-h-12 rounded-lg border border-slate-300 px-4"
          aria-label="Filter by state"
        >
          <option value="">All states</option>
          {US_STATES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
        <Button type="submit">Search</Button>
      </form>
      {companiesQuery.isLoading ? (
        <Card className="mt-8 p-8 text-center">
          <h2 className="text-xl font-black">Loading contractors</h2>
          <p className="mt-2 text-slate-600">Checking current service states.</p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {filtered.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
      {useDemoFallback ? (
        <p className="mt-4 text-sm text-slate-500" role="alert">
          Showing demo contractors for testing until live contractors are seeded.
        </p>
      ) : null}
      {companiesQuery.isError ? (
        <Card className="mt-8 p-8 text-center" role="alert">
          <h2 className="text-xl font-black">Search is temporarily unavailable</h2>
          <p className="mt-2 text-slate-600">Please try again in a moment.</p>
        </Card>
      ) : null}
      {!companiesQuery.isLoading && !companiesQuery.isError && filtered.length === 0 ? (
        <Card className="mt-8 p-10 text-center">
          <h2 className="text-xl font-black">No exact matches yet</h2>
          <p className="mt-2 text-slate-600">Try another service or state near {emptyLocation}.</p>
          <SecondaryButton className="mt-5" onClick={() => setParams({})}>
            Clear filters
          </SecondaryButton>
        </Card>
      ) : null}
    </div>
  )
}

function CompanyCard({ company }: { company: CompanySummary }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid h-40 place-items-center bg-gradient-to-br from-slate-800 to-slate-950 text-amber-300">
        <Building2 size={54} />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{company.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
              <MapPin size={15} /> {company.city}, {company.state}
            </p>
          </div>
          {company.verified ? (
            <Badge tone="success">
              <BadgeCheck className="mr-1 inline" size={14} /> Verified
            </Badge>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1 font-bold">
            <Star size={16} className="fill-amber-400 text-amber-400" /> {company.rating}
          </span>
          <span className="text-slate-500">({company.reviewCount} reviews)</span>
        </div>
        <p className="mt-4 min-h-18 leading-6 text-slate-600">{company.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {company.categories.map((item) => (
            <span
              key={item}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>
        <Link to={`/companies/${company.slug}`} className="mt-5 block">
          <Button className="w-full">View company</Button>
        </Link>
      </div>
    </Card>
  )
}

export function CompanyPage() {
  const { slug } = useParams()
  const fallbackCompany =
    demoCompanies.find((company) => company.slug === slug) ?? demoCompanies[0]!
  const companyQuery = useQuery({
    queryKey: ['company', slug],
    queryFn: () =>
      apiRequest<
        CompanySummary & { services?: Array<{ id: string; title: string; description: string }> }
      >(`/companies/${slug ?? fallbackCompany.slug}`),
    retry: false,
  })
  const company = companyQuery.data ?? fallbackCompany
  const services: Array<{ id?: string; title: string }> =
    companyQuery.data?.services?.map((service) => ({ id: service.id, title: service.title })) ??
    (demoServicesBySlug[fallbackCompany.slug] ?? []).map((title) => ({ title }))
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success">
              <BadgeCheck className="mr-1 inline" size={14} /> Manually verified
            </Badge>
            <span className="flex items-center gap-1 font-bold">
              <Star className="fill-amber-400 text-amber-400" size={18} /> {company.rating} (
              {company.reviewCount})
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-black">{company.name}</h1>
          <p className="mt-2 flex items-center gap-2 text-slate-600">
            <MapPin size={18} /> {company.city}, {company.state} - {company.serviceRadiusMiles} mile
            service radius
          </p>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            {company.description} Our team documents the scope, keeps project updates organized, and
            provides itemized invoices after completed work.
          </p>
          <section className="mt-10">
            <h2 className="text-2xl font-black">Services</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {services.map((service) => (
                <Card key={service.title} className="p-5">
                  <h3 className="font-black">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Request a site-specific quote with timing, address, and project scope.
                  </p>
                  <Link
                    to={`/request-quote?company=${company.id}${
                      service.id ? `&service=${service.id}` : ''
                    }&serviceName=${encodeURIComponent(service.title)}`}
                    className="mt-4 inline-block"
                  >
                    <SecondaryButton>Request this service</SecondaryButton>
                  </Link>
                </Card>
              ))}
            </div>
          </section>
          <section className="mt-10">
            <h2 className="text-2xl font-black">Credentials</h2>
            <Card className="mt-4 p-5">
              <div className="flex gap-3">
                <ShieldCheck className="text-emerald-600" />
                <div>
                  <p className="font-bold">Business and license reviewed</p>
                  <p className="mt-1 text-sm text-slate-600">
                    License {company.licenseNumber}. Verification status does not replace buyer due
                    diligence.
                  </p>
                </div>
              </div>
            </Card>
          </section>
        </div>
        <aside>
          <Card className="sticky top-24 p-6">
            <h2 className="text-xl font-black">Tell them about your project</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A complete request helps the contractor respond faster.
            </p>
            <ul className="mt-5 grid gap-3 text-sm">
              {[
                'Address and project scope',
                'Preferred start timing',
                'Budget range, if known',
                'Important site constraints',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="shrink-0 text-emerald-600" size={18} /> {item}
                </li>
              ))}
            </ul>
            <Link to={`/request-quote?company=${company.id}`} className="mt-6 block">
              <Button className="w-full">Request a quote</Button>
            </Link>
            <p className="mt-3 text-center text-xs text-slate-500">No payment is collected.</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function HowItWorksPage() {
  return (
    <SimpleMarketingPage
      eyebrow="A construction-native workflow"
      title="From first request to final invoice"
      body="Buyers provide the details contractors need. Companies respond with a proposal, organize the work, document changes, and issue a professional invoice after completion."
    />
  )
}
export function ForBusinessesPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Built for trade businesses"
      title="Turn qualified requests into organized jobs"
      body="Create a verified profile, list services and service areas, respond to leads, track work, and send itemized invoices without stitching together texts and paper forms."
      action="Start company onboarding"
    />
  )
}

function SimpleMarketingPage({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string
  title: string
  body: string
  action?: string
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <Badge tone="warning">{eyebrow}</Badge>
      <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-tight">{title}</h1>
      <p className="mt-6 max-w-2xl text-xl leading-9 text-slate-600">{body}</p>
      {action ? (
        <Link to="/dashboard/company" className="mt-8 inline-block">
          <Button>{action}</Button>
        </Link>
      ) : null}
    </div>
  )
}
