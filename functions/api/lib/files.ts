import { and, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { Context } from 'hono'
import {
  companyMembers,
  files,
  jobAssignments,
  jobs,
  quoteRequests,
} from '../../../shared/db/schema'
import { HttpError } from './http'
import type { Actor, AppEnv } from './types'

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

const signatures = [
  {
    mime: 'image/jpeg',
    matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    mime: 'image/png',
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
  },
  {
    mime: 'image/webp',
    matches: (bytes: Uint8Array) =>
      new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP',
  },
  {
    mime: 'application/pdf',
    matches: (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-',
  },
] as const

export function validateFile(bytes: Uint8Array, declaredType: string): string {
  const detected = signatures.find((signature) => signature.matches(bytes))?.mime
  if (!detected || detected !== declaredType) {
    throw new HttpError(
      415,
      'unsupported_file',
      'The file content does not match an allowed JPEG, PNG, WebP, or PDF type.',
    )
  }
  return detected
}

export async function canAccessFile(c: Context<AppEnv>, actor: Actor, fileId: string) {
  const db = drizzle(c.env.DB)
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .limit(1)
  if (!file) throw new HttpError(404, 'file_not_found', 'File not found.')
  if (actor.role === 'platform_admin' || file.ownerUserId === actor.id) return file

  if (file.quoteRequestId) {
    const [quote] = await db
      .select({
        buyerId: quoteRequests.buyerId,
        companyId: quoteRequests.companyId,
        assignedToUserId: quoteRequests.assignedToUserId,
      })
      .from(quoteRequests)
      .where(eq(quoteRequests.id, file.quoteRequestId))
      .limit(1)
    if (quote?.buyerId === actor.id) return file
    if (quote) {
      const [membership] = await db
        .select({ companyId: companyMembers.companyId, role: companyMembers.role })
        .from(companyMembers)
        .where(
          and(
            eq(companyMembers.companyId, quote.companyId),
            eq(companyMembers.userId, actor.id),
            eq(companyMembers.status, 'active'),
          ),
        )
        .limit(1)
      if (membership?.role === 'company_admin') return file
      if (membership?.role === 'staff' && quote.assignedToUserId === actor.id) return file
    }
  }
  if (file.jobId) {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, file.jobId), eq(jobs.buyerId, actor.id)))
      .limit(1)
    if (job) return file
    if (file.companyId) {
      const [membership] = await db
        .select({ companyId: companyMembers.companyId, role: companyMembers.role })
        .from(companyMembers)
        .where(
          and(
            eq(companyMembers.companyId, file.companyId),
            eq(companyMembers.userId, actor.id),
            eq(companyMembers.status, 'active'),
          ),
        )
        .limit(1)
      if (membership?.role === 'company_admin') return file
      if (membership?.role === 'staff') {
        const [assignment] = await db
          .select({ jobId: jobAssignments.jobId })
          .from(jobAssignments)
          .where(and(eq(jobAssignments.jobId, file.jobId), eq(jobAssignments.userId, actor.id)))
          .limit(1)
        if (assignment) return file
      }
    }
  }
  throw new HttpError(403, 'file_access_denied', 'You cannot access this file.')
}
