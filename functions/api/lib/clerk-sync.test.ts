import type { UserJSON, WebhookEvent } from '@clerk/backend'
import { describe, expect, it } from 'vitest'
import { buildClerkUserSyncAction, ClerkUserSyncError } from './clerk-sync'

function clerkUser(overrides: Partial<UserJSON> = {}): UserJSON {
  return {
    object: 'user',
    id: 'user_123',
    username: null,
    first_name: 'Jordan',
    last_name: 'Rivera',
    image_url: '',
    has_image: false,
    primary_email_address_id: 'email_1',
    primary_phone_number_id: 'phone_1',
    primary_web3_wallet_id: null,
    password_enabled: true,
    two_factor_enabled: false,
    totp_enabled: false,
    backup_code_enabled: false,
    email_addresses: [
      {
        object: 'email_address',
        id: 'email_1',
        email_address: 'jordan@example.com',
        verification: null,
        linked_to: [],
      },
    ],
    phone_numbers: [
      {
        object: 'phone_number',
        id: 'phone_1',
        phone_number: '+13125550100',
        reserved_for_second_factor: false,
        default_second_factor: false,
        verification: null,
        linked_to: [],
      },
    ],
    web3_wallets: [],
    organization_memberships: null,
    external_accounts: [],
    enterprise_accounts: [],
    password_last_updated_at: null,
    public_metadata: {},
    private_metadata: {},
    unsafe_metadata: {},
    external_id: null,
    last_sign_in_at: null,
    banned: false,
    locked: false,
    lockout_expires_in_seconds: null,
    verification_attempts_remaining: null,
    created_at: 1,
    updated_at: 1,
    last_active_at: null,
    create_organization_enabled: true,
    create_organizations_limit: null,
    delete_self_enabled: true,
    legal_accepted_at: null,
    locale: null,
    ...overrides,
  } as UserJSON
}

function userEvent(type: 'user.created' | 'user.updated', data: UserJSON): WebhookEvent {
  return {
    object: 'event',
    type,
    data,
    event_attributes: { http_request: { client_ip: '127.0.0.1', user_agent: 'vitest' } },
  }
}

describe('buildClerkUserSyncAction', () => {
  it('builds a server-owned upsert from Clerk user data', () => {
    const action = buildClerkUserSyncAction(
      userEvent(
        'user.created',
        clerkUser({ private_metadata: { platformRole: 'platform_admin' } }),
      ),
    )

    expect(action).toMatchObject({
      action: 'upsert',
      clerkUserId: 'user_123',
      name: 'Jordan Rivera',
      email: 'jordan@example.com',
      phone: '+13125550100',
      platformRole: 'platform_admin',
      status: 'active',
    })
  })

  it('ignores client-readable and client-writable role metadata', () => {
    const action = buildClerkUserSyncAction(
      userEvent(
        'user.updated',
        clerkUser({
          public_metadata: { platformRole: 'platform_admin' },
          unsafe_metadata: { platformRole: 'platform_admin' },
        }),
      ),
    )

    expect(action).toMatchObject({ action: 'upsert', platformRole: null })
  })

  it('marks banned or locked Clerk users as suspended locally', () => {
    expect(
      buildClerkUserSyncAction(userEvent('user.updated', clerkUser({ banned: true }))),
    ).toMatchObject({ action: 'upsert', status: 'suspended' })
    expect(
      buildClerkUserSyncAction(userEvent('user.updated', clerkUser({ locked: true }))),
    ).toMatchObject({ action: 'upsert', status: 'suspended' })
  })

  it('builds a delete action for deleted Clerk users', () => {
    const action = buildClerkUserSyncAction({
      object: 'event',
      type: 'user.deleted',
      data: { object: 'user', id: 'user_123', deleted: true },
      event_attributes: { http_request: { client_ip: '127.0.0.1', user_agent: 'vitest' } },
    })

    expect(action).toEqual({ action: 'delete', clerkUserId: 'user_123' })
  })

  it('rejects user upserts without an email address', () => {
    expect(() =>
      buildClerkUserSyncAction(userEvent('user.created', clerkUser({ email_addresses: [] }))),
    ).toThrow(ClerkUserSyncError)
  })

  it('ignores unrelated Clerk webhook event types', () => {
    const action = buildClerkUserSyncAction({
      object: 'event',
      type: 'session.created',
      data: {},
      event_attributes: { http_request: { client_ip: '127.0.0.1', user_agent: 'vitest' } },
    } as WebhookEvent)

    expect(action).toEqual({ action: 'ignore', eventType: 'session.created' })
  })
})
