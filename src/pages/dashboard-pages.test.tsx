import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  getToken: vi.fn<() => Promise<string | null>>(),
  isLoaded: true,
}))

vi.mock('@clerk/react', () => ({
  useAuth: () => ({
    getToken: authState.getToken,
    isLoaded: authState.isLoaded,
  }),
}))

const demoCompanyId = '11111111-1111-4111-8111-111111111111'
const liveCompanyId = '22222222-2222-4222-8222-222222222222'

type FetchSpy = {
  mock: {
    calls: Parameters<typeof fetch>[]
  }
}

async function renderCompanyDashboard(clerkPublishableKey: string) {
  vi.doMock('../lib/config', () => ({
    appConfig: {
      clerkPublishableKey,
      name: 'Workyard',
    },
  }))
  const { CompanyDashboardPage } = await import('./dashboard-pages')
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <CompanyDashboardPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

function requestUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function jsonResponse(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data, meta: { requestId: 'req_1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function expectFetchCall(fetchMock: FetchSpy, url: string) {
  const call = fetchMock.mock.calls.find(([input]) => requestUrl(input) === url)
  expect(call).toBeDefined()
  return call as [Parameters<typeof fetch>[0], RequestInit]
}

function fetchUrls(fetchMock: FetchSpy) {
  return fetchMock.mock.calls.map(([input]) => requestUrl(input))
}

describe('CompanyDashboardPage service states', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.resetModules()
    authState.getToken.mockReset()
    authState.isLoaded = true
  })

  it('uses the signed-in company admin membership from /me in Clerk mode', async () => {
    authState.getToken.mockResolvedValue('live-session')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input)
      if (url === '/api/v1/me') {
        return jsonResponse({
          id: 'contractor_1',
          memberships: [
            {
              companyId: liveCompanyId,
              companyName: 'Prairie & Stone Builders',
              role: 'company_admin',
              companyStatus: 'verified',
            },
          ],
        })
      }
      if (url === '/api/v1/service-categories') {
        return jsonResponse([
          {
            id: '10000000-0000-4000-8000-000000000001',
            name: 'Electrical',
            slug: 'electrical',
          },
        ])
      }
      if (url === `/api/v1/companies/${liveCompanyId}/onboarding`) {
        return jsonResponse({
          id: liveCompanyId,
          name: 'Prairie & Stone Builders',
          description: 'Licensed remodeling and finish carpentry for regional properties.',
          licenseNumber: 'GC-22391',
          website: 'https://example.com/prairie-stone',
          phone: '303-555-0168',
          email: 'hello@prairiestone.example',
          city: 'Denver',
          state: 'CO',
          zip: '80202',
          serviceRadiusMiles: 35,
          status: 'verified',
          serviceStates: ['IL', 'WI'],
          serviceCategoryIds: ['10000000-0000-4000-8000-000000000001'],
        })
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })

    await renderCompanyDashboard('pk_test')

    expect(await screen.findByLabelText('Illinois (IL)')).toBeChecked()
    const [, onboardingInit] = expectFetchCall(
      fetchMock,
      `/api/v1/companies/${liveCompanyId}/onboarding`,
    )

    expect(onboardingInit.headers).toMatchObject({
      Authorization: 'Bearer live-session',
    })
    expect(fetchUrls(fetchMock)).not.toContain(`/api/v1/companies/${demoCompanyId}/onboarding`)
  })

  it('preserves the seeded demo company when Clerk is not configured', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input)
      if (url === '/api/v1/service-categories') {
        return jsonResponse([
          {
            id: '10000000-0000-4000-8000-000000000001',
            name: 'Electrical',
            slug: 'electrical',
          },
        ])
      }
      if (url === `/api/v1/companies/${demoCompanyId}/onboarding`) {
        return jsonResponse({
          id: demoCompanyId,
          name: 'Lakefront Electric Co.',
          description: 'Licensed residential and light-commercial electrical work.',
          licenseNumber: 'ECC-10482',
          website: 'https://example.com/lakefront-electric',
          phone: '216-555-0118',
          email: 'hello@lakefrontelectric.example',
          city: 'Cleveland',
          state: 'OH',
          zip: '44114',
          serviceRadiusMiles: 28,
          status: 'verified',
          serviceStates: ['IL', 'IN'],
          serviceCategoryIds: ['10000000-0000-4000-8000-000000000001'],
        })
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })

    await renderCompanyDashboard('')

    expect(await screen.findByLabelText('Indiana (IN)')).toBeChecked()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/companies/${demoCompanyId}/onboarding`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Demo-User': 'demo_contractor',
          }) as HeadersInit,
        }),
      )
    })
    expect(fetchUrls(fetchMock)).not.toContain('/api/v1/me')
  })
})
