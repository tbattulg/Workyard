import { describe, expect, it } from 'vitest'
import { validateFile } from './files'

describe('validateFile', () => {
  it('accepts supported files when declared type matches magic bytes', () => {
    expect(validateFile(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg')).toBe('image/jpeg')
    expect(validateFile(new TextEncoder().encode('%PDF-1.7'), 'application/pdf')).toBe(
      'application/pdf',
    )
  })

  it('rejects content-type spoofing', () => {
    expect(() => validateFile(new TextEncoder().encode('%PDF-1.7'), 'image/png')).toThrow(
      'file content does not match',
    )
  })
})
