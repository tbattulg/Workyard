import { describe, expect, it } from 'vitest'
import { getDemoClerkUserId, isDemoAuthEnabled } from './auth'

describe('demo auth controls', () => {
  it('allows demo auth only outside production', () => {
    expect(isDemoAuthEnabled({ ALLOW_DEMO_AUTH: 'true', ENVIRONMENT: 'preview' })).toBe(true)
    expect(isDemoAuthEnabled({ ALLOW_DEMO_AUTH: 'false', ENVIRONMENT: 'preview' })).toBe(false)
    expect(isDemoAuthEnabled({ ALLOW_DEMO_AUTH: 'true', ENVIRONMENT: 'production' })).toBe(false)
  })

  it('ignores x-demo-user in production', () => {
    const request = new Request('https://example.com/api/v1/me', {
      headers: { 'x-demo-user': 'demo_admin' },
    })

    expect(getDemoClerkUserId({ ALLOW_DEMO_AUTH: 'true', ENVIRONMENT: 'production' }, request)).toBe(
      null,
    )
    expect(getDemoClerkUserId({ ALLOW_DEMO_AUTH: 'true', ENVIRONMENT: 'preview' }, request)).toBe(
      'demo_admin',
    )
  })
})
