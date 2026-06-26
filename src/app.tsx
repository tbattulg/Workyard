import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { DashboardLayout, SiteLayout } from './components/layout'
import {
  AdminPage,
  CompanyDashboardPage,
  DashboardPage,
  InvoicesPage,
  JobsPage,
  LeadsPage,
} from './pages/dashboard-pages'
import { InvoiceBuilderPage, QuoteRequestPage, SupportPage } from './pages/forms-pages'
import { LegalPage } from './pages/legal-pages'
import {
  BrowsePage,
  CompanyPage,
  ForBusinessesPage,
  HomePage,
  HowItWorksPage,
} from './pages/public-pages'

export function App() {
  return (
    <Routes>
      <Route
        element={
          <SiteLayout>
            <Outlet />
          </SiteLayout>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/companies/:slug" element={<CompanyPage />} />
        <Route path="/request-quote" element={<QuoteRequestPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/for-businesses" element={<ForBusinessesPage />} />
        <Route path="/help" element={<SupportPage />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/vendor-agreement" element={<LegalPage kind="vendor" />} />
        <Route path="/disputes" element={<LegalPage kind="disputes" />} />
      </Route>
      <Route
        element={
          <DashboardLayout>
            <Outlet />
          </DashboardLayout>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/company" element={<CompanyDashboardPage />} />
        <Route path="/dashboard/leads" element={<LeadsPage />} />
        <Route path="/dashboard/jobs" element={<JobsPage />} />
        <Route path="/dashboard/invoices" element={<InvoicesPage />} />
        <Route path="/dashboard/invoices/new" element={<InvoiceBuilderPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
