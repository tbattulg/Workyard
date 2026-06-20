import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api'

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('unwraps API success envelopes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true }, meta: { requestId: 'req_1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(apiRequest<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true })
  })

  it('throws structured API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'invalid_quote', message: 'Review the project request.' },
        }),
        { status: 422, headers: { 'content-type': 'application/json' } },
      ),
    )

    await expect(apiRequest('/quotes')).rejects.toMatchObject({
      code: 'invalid_quote',
      status: 422,
    })
  })

  it('adds auth and demo headers only when requested', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true }, meta: { requestId: 'req_1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await apiRequest('/quotes', { method: 'POST', body: JSON.stringify({ ok: true }) }, {
      authToken: 'session-token',
      demoUser: 'demo_admin',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).toBe('/api/v1/quotes')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Demo-User': 'demo_admin',
    })
  })

  it('handles non-json development fallbacks as API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<!doctype html>', { status: 404, headers: { 'content-type': 'text/html' } }),
    )

    await expect(apiRequest('/companies')).rejects.toMatchObject({
      code: 'unexpected_response',
      status: 404,
    })
  })
})
