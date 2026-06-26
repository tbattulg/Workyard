import type { Context } from 'hono'
import type { ZodError } from 'zod'
import type { ApiSuccess } from '../../../shared/domain'
import type { AppEnv } from './types'

export class HttpError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 503,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message)
  }
}

export function ok<T>(
  c: Context<AppEnv>,
  data: T,
  meta?: Omit<NonNullable<ApiSuccess<T>['meta']>, 'requestId'>,
) {
  return c.json({ data, meta: { ...meta, requestId: c.get('requestId') } })
}

export function validationFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'request'
    fields[key] = [...(fields[key] ?? []), issue.message]
  }
  return fields
}

export function handleError(c: Context<AppEnv>, error: unknown) {
  const requestId = c.get('requestId')
  if (error instanceof HttpError) {
    return c.json(
      { error: { code: error.code, message: error.message, fields: error.fields, requestId } },
      error.status,
    )
  }

  console.error(
    JSON.stringify({
      message: 'unhandled request error',
      requestId,
      path: c.req.path,
      error: error instanceof Error ? error.message : String(error),
    }),
  )
  return c.json(
    {
      error: { code: 'internal_error', message: 'The request could not be completed.', requestId },
    },
    500,
  )
}
