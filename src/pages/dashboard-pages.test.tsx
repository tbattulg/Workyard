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
      name: 'Contractor Marketplace',
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
      if (url === `/api/v1/companies/${liveCompanyId}/service-states`) {
        return jsonResponse({ states: ['IL', 'WI'] })
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })

    await renderCompanyDashboard('pk_test')

    expect(await screen.findByLabelText('Illinois (IL)')).toBeChecked()
    const [, serviceStatesInit] = expectFetchCall(
      fetchMock,
      `/api/v1/companies/${liveCompanyId}/service-states`,
    )

    expect(serviceStatesInit.headers).toMatchObject({
      Authorization: 'Bearer live-session',
    })
    expect(fetchUrls(fetchMock)).not.toContain(`/api/v1/companies/${demoCompanyId}/service-states`)
  })

  it('preserves the seeded demo company when Clerk is not configured', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input)
      if (url === `/api/v1/companies/${demoCompanyId}/service-states`) {
        return jsonResponse({ states: ['IL', 'IN'] })
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })

    await renderCompanyDashboard('')

    expect(await screen.findByLabelText('Indiana (IN)')).toBeChecked()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/companies/${demoCompanyId}/service-states`,
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
