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
