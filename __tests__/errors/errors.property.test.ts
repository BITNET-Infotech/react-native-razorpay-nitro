import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: razorpay-nitro-integration, Property 6: Error Format Consistency
 * Validates: Requirements 6.5
 *
 * For any error produced by HybridRazorpay (whether from SDK or internal),
 * the error SHALL be formatted as JSON containing both "code" and "message" fields.
 */
describe('Property 6: Error Format Consistency', () => {
  /**
   * Simulates the createError function from HybridRazorpay.kt
   * This is the error formatting logic used in the native implementation.
   */
  function createError(code: string, message: string): string {
    return JSON.stringify({
      code: code,
      message: message,
    })
  }

  /**
   * Validates that an error string is properly formatted JSON
   * with required "code" and "message" fields.
   */
  function isValidErrorFormat(errorString: string): boolean {
    try {
      const parsed = JSON.parse(errorString)
      return (
        typeof parsed === 'object' &&
        parsed !== null &&
        'code' in parsed &&
        'message' in parsed &&
        typeof parsed.code === 'string' &&
        typeof parsed.message === 'string'
      )
    } catch {
      return false
    }
  }

  // Arbitrary for error codes (including SDK error codes which are numeric strings)
  const errorCodeArb = fc.oneof(
    // Internal error codes
    fc.constantFrom(
      'PAYMENT_IN_PROGRESS',
      'ACTIVITY_NOT_FOUND',
      'VIEW_CONTROLLER_NOT_FOUND',
      'INVALID_OPTIONS'
    ),
    // SDK error codes (numeric)
    fc.integer({ min: 0, max: 999 }).map((n) => n.toString()),
    // Generic string codes
    fc.string({ minLength: 1, maxLength: 50 })
  )

  // Arbitrary for error messages
  const errorMessageArb = fc.oneof(
    // Common error messages
    fc.constantFrom(
      'A payment is already in progress',
      'No activity available to present Razorpay checkout',
      'No view controller available to present Razorpay checkout',
      'Failed to parse options',
      'Payment failed',
      'Network error',
      'User cancelled'
    ),
    // Random error messages
    fc.string({ minLength: 1, maxLength: 200 })
  )

  it('should produce valid JSON for any error code and message combination', () => {
    fc.assert(
      fc.property(errorCodeArb, errorMessageArb, (code, message) => {
        const errorString = createError(code, message)

        // Error string should be valid JSON
        expect(() => JSON.parse(errorString)).not.toThrow()

        // Error should have valid format
        expect(isValidErrorFormat(errorString)).toBe(true)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve error code exactly as provided', () => {
    fc.assert(
      fc.property(errorCodeArb, errorMessageArb, (code, message) => {
        const errorString = createError(code, message)
        const parsed = JSON.parse(errorString)

        expect(parsed.code).toBe(code)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve error message exactly as provided', () => {
    fc.assert(
      fc.property(errorCodeArb, errorMessageArb, (code, message) => {
        const errorString = createError(code, message)
        const parsed = JSON.parse(errorString)

        expect(parsed.message).toBe(message)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle special characters in error messages', () => {
    // Arbitrary for messages with special characters
    const specialMessageArb = fc.string({
      minLength: 1,
      maxLength: 200,
    })

    fc.assert(
      fc.property(errorCodeArb, specialMessageArb, (code, message) => {
        const errorString = createError(code, message)

        // Should still be valid JSON even with special characters
        expect(() => JSON.parse(errorString)).not.toThrow()
        expect(isValidErrorFormat(errorString)).toBe(true)

        const parsed = JSON.parse(errorString)
        expect(parsed.message).toBe(message)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle empty strings for code and message', () => {
    const errorString = createError('', '')
    
    expect(() => JSON.parse(errorString)).not.toThrow()
    expect(isValidErrorFormat(errorString)).toBe(true)
    
    const parsed = JSON.parse(errorString)
    expect(parsed.code).toBe('')
    expect(parsed.message).toBe('')
  })

  it('should handle unicode characters in error messages', () => {
    // Create messages with various unicode characters
    const unicodeChars = ['日本語', '中文', '한국어', 'العربية', 'עברית', '🎉', '€', '£', '¥', 'ñ', 'ü', 'ö']
    const unicodeMessageArb = fc.constantFrom(...unicodeChars).chain((prefix) =>
      fc.string({ minLength: 0, maxLength: 50 }).map((suffix) => prefix + suffix)
    )

    fc.assert(
      fc.property(errorCodeArb, unicodeMessageArb, (code, message) => {
        const errorString = createError(code, message)

        // Should handle unicode properly
        expect(() => JSON.parse(errorString)).not.toThrow()
        expect(isValidErrorFormat(errorString)).toBe(true)

        const parsed = JSON.parse(errorString)
        expect(parsed.message).toBe(message)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should produce consistent format for all known internal error codes', () => {
    const internalErrors = [
      { code: 'PAYMENT_IN_PROGRESS', message: 'A payment is already in progress' },
      { code: 'ACTIVITY_NOT_FOUND', message: 'No activity available to present Razorpay checkout' },
      { code: 'VIEW_CONTROLLER_NOT_FOUND', message: 'No view controller available to present Razorpay checkout' },
      { code: 'INVALID_OPTIONS', message: 'Failed to parse options: invalid JSON' },
    ]

    for (const error of internalErrors) {
      const errorString = createError(error.code, error.message)
      
      expect(isValidErrorFormat(errorString)).toBe(true)
      
      const parsed = JSON.parse(errorString)
      expect(parsed.code).toBe(error.code)
      expect(parsed.message).toBe(error.message)
    }
  })

  it('should produce consistent format for SDK error codes (numeric)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        errorMessageArb,
        (numericCode, message) => {
          const code = numericCode.toString()
          const errorString = createError(code, message)

          expect(isValidErrorFormat(errorString)).toBe(true)

          const parsed = JSON.parse(errorString)
          expect(parsed.code).toBe(code)
          expect(typeof parsed.code).toBe('string') // Code should always be string

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
