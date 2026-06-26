import type { ApiErrorShape, ApiSuccess } from '../../shared/domain'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message)
  }
}

export interface ApiRequestOptions {
  authToken?: string | null
  demoUser?: string
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
      ...(options.demoUser ? { 'X-Demo-User': options.demoUser } : {}),
      ...init?.headers,
    },
  })

  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? ((await response.json()) as ApiSuccess<T> | ApiErrorShape)
    : ({
        error: { code: 'unexpected_response', message: 'The API did not return JSON.' },
      } satisfies ApiErrorShape)
  if (!response.ok || 'error' in body) {
    const error = 'error' in body ? body.error : { code: 'unknown', message: 'Request failed' }
    throw new ApiError(error.message, error.code, response.status, error.fields)
  }

  return body.data
}
