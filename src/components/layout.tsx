import {
  BriefcaseBusiness,
  Building2,
  FileText,
  HardHat,
  Menu,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { appConfig } from '../lib/config'
import { cn } from '../lib/cn'
import { Button, SecondaryButton } from './ui'

const nav = [
  { to: '/browse', label: 'Find contractors' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/for-businesses', label: 'For businesses' },
]

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-black tracking-tight text-slate-950">
            <span className="grid size-10 place-items-center rounded-xl bg-slate-950 text-amber-400">
              <HardHat size={22} aria-hidden="true" />
            </span>
            <span>{appConfig.name}</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="text-sm font-semibold text-slate-600 hover:text-slate-950"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/dashboard">
              <SecondaryButton>Dashboard</SecondaryButton>
            </Link>
            <Link to="/request-quote">
              <Button>Request a quote</Button>
            </Link>
          </div>
          <button
            className="grid size-11 place-items-center rounded-lg border border-slate-200 md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open ? (
          <nav
            className="grid gap-2 border-t border-slate-200 bg-white p-4 md:hidden"
            aria-label="Mobile navigation"
          >
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-3 font-semibold"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/dashboard"
              className="rounded-lg px-3 py-3 font-semibold"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
          </nav>
        ) : null}
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-bold text-white">
              <HardHat className="text-amber-400" /> {appConfig.name}
            </div>
            <p className="mt-3 max-w-md text-sm leading-6">
              A clearer path from project request to completed work and professional invoice.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-white">Marketplace</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <Link to="/browse">Browse services</Link>
              <Link to="/for-businesses">List a business</Link>
              <Link to="/help">Help center</Link>
            </div>
          </div>
          <div>
            <h2 className="font-bold text-white">Legal</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/vendor-agreement">Vendor agreement</Link>
              <Link to="/disputes">Disputes</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const links = [
    { to: '/dashboard', label: 'Overview', icon: BriefcaseBusiness },
    { to: '/dashboard/leads', label: 'Leads', icon: Search },
    { to: '/dashboard/jobs', label: 'Jobs', icon: Building2 },
    { to: '/dashboard/invoices', label: 'Invoices', icon: FileText },
    { to: '/admin', label: 'Admin', icon: ShieldCheck },
  ]
  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-slate-800 bg-slate-950 p-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link to="/" className="flex items-center gap-2 font-black">
          <HardHat className="text-amber-400" /> {appConfig.name}
        </Link>
        <nav className="mt-7 flex gap-2 overflow-x-auto lg:grid" aria-label="Dashboard navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                cn(
                  'flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white',
                  isActive && 'bg-slate-800 text-amber-300',
                )
              }
            >
              <Icon size={18} aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm">
          <p className="font-bold text-white">Demo workspace</p>
          <p className="mt-1 text-slate-400">Connect Clerk to use real accounts.</p>
        </div>
      </aside>
      <div>{children}</div>
    </div>
  )
}
