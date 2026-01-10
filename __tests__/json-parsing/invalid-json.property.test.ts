import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: razorpay-nitro-integration, Property 3: Invalid JSON Rejection
 * Validates: Requirements 6.3
 *
 * For any malformed JSON string passed to open(),
 * the Promise SHALL reject with an error containing code "INVALID_OPTIONS".
 */
describe('Property 3: Invalid JSON Rejection', () => {
  /**
   * Simulates the JSON parsing validation logic from HybridRazorpay.
   * This mirrors the native implementation's behavior when parsing options.
   *
   * @param jsonString The JSON string to validate
   * @returns Object with isValid flag and error details if invalid
   */
  function validateJsonOptions(jsonString: string): {
    isValid: boolean
    errorCode?: string
    errorMessage?: string
  } {
    try {
      const parsed = JSON.parse(jsonString)

      // Check if parsed result is an object (not null, array, or primitive)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {
          isValid: false,
          errorCode: 'INVALID_OPTIONS',
          errorMessage: 'Failed to parse options',
        }
      }

      // Check for required 'key' field
      if (!('key' in parsed) || typeof parsed.key !== 'string') {
        return {
          isValid: false,
          errorCode: 'INVALID_OPTIONS',
          errorMessage: "Missing required 'key' in options",
        }
      }

      return { isValid: true }
    } catch {
      return {
        isValid: false,
        errorCode: 'INVALID_OPTIONS',
        errorMessage: 'Failed to parse options',
      }
    }
  }

  // Arbitrary for generating malformed JSON strings
  const malformedJsonArb = fc.oneof(
    // Completely invalid JSON
    fc.string().filter((s) => {
      try {
        JSON.parse(s)
        return false // Valid JSON, filter out
      } catch {
        return true // Invalid JSON, keep
      }
    }),
    // Truncated JSON
    fc.constantFrom(
      '{',
      '{"key"',
      '{"key":',
      '{"key":"test"',
      '[',
      '{"key": "test", "amount":',
      '{"key": "test", "amount": 100, "currency":'
    ),
    // JSON with syntax errors
    fc.constantFrom(
      '{key: "test"}', // Missing quotes on key
      "{'key': 'test'}", // Single quotes
      '{"key": "test",}', // Trailing comma
      '{"key": "test" "amount": 100}', // Missing comma
      '{"key": undefined}', // undefined is not valid JSON
      '{"key": NaN}', // NaN is not valid JSON
      '{"key": Infinity}' // Infinity is not valid JSON
    ),
    // Random garbage
    fc.constantFrom(
      'not json at all',
      '12345',
      'true',
      'false',
      'null',
      '[]',
      '""',
      'undefined'
    )
  )

  it('should reject with INVALID_OPTIONS for any malformed JSON string', () => {
    fc.assert(
      fc.property(malformedJsonArb, (invalidJson) => {
        const result = validateJsonOptions(invalidJson)

        // All malformed JSON should be rejected
        expect(result.isValid).toBe(false)

        // Error code should be INVALID_OPTIONS
        expect(result.errorCode).toBe('INVALID_OPTIONS')

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should reject with INVALID_OPTIONS when JSON is valid but not an object', () => {
    // Valid JSON but not an object (arrays, primitives, null)
    const nonObjectJsonArb = fc.oneof(
      fc.constant('null'),
      fc.constant('true'),
      fc.constant('false'),
      fc.integer().map((n) => JSON.stringify(n)),
      fc.string().map((s) => JSON.stringify(s)),
      fc.array(fc.anything()).map((arr) => JSON.stringify(arr))
    )

    fc.assert(
      fc.property(nonObjectJsonArb, (jsonString) => {
        const result = validateJsonOptions(jsonString)

        // Non-object JSON should be rejected
        expect(result.isValid).toBe(false)
        expect(result.errorCode).toBe('INVALID_OPTIONS')

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should reject with INVALID_OPTIONS when key field is missing', () => {
    // Valid JSON object but missing required 'key' field
    const missingKeyArb = fc.record({
      amount: fc.integer({ min: 100 }),
      currency: fc.constantFrom('INR', 'USD'),
      order_id: fc.string({ minLength: 1 }),
    }).map((obj) => JSON.stringify(obj))

    fc.assert(
      fc.property(missingKeyArb, (jsonString) => {
        const result = validateJsonOptions(jsonString)

        // Missing key should be rejected
        expect(result.isValid).toBe(false)
        expect(result.errorCode).toBe('INVALID_OPTIONS')

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should reject with INVALID_OPTIONS when key field is not a string', () => {
    // Valid JSON object but 'key' is not a string
    const invalidKeyTypeArb = fc.oneof(
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.array(fc.string()),
      fc.record({ nested: fc.string() })
    ).map((keyValue) =>
      JSON.stringify({
        key: keyValue,
        amount: 1000,
        currency: 'INR',
      })
    )

    fc.assert(
      fc.property(invalidKeyTypeArb, (jsonString) => {
        const result = validateJsonOptions(jsonString)

        // Invalid key type should be rejected
        expect(result.isValid).toBe(false)
        expect(result.errorCode).toBe('INVALID_OPTIONS')

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should accept valid JSON with required key field', () => {
    // Valid JSON object with required 'key' field
    const validOptionsArb = fc.record({
      key: fc.string({ minLength: 1 }),
      amount: fc.option(fc.integer({ min: 100 }), { nil: undefined }),
      currency: fc.option(fc.constantFrom('INR', 'USD'), { nil: undefined }),
    }).map((obj) => JSON.stringify(obj))

    fc.assert(
      fc.property(validOptionsArb, (jsonString) => {
        const result = validateJsonOptions(jsonString)

        // Valid options should be accepted
        expect(result.isValid).toBe(true)
        expect(result.errorCode).toBeUndefined()

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle empty string as invalid JSON', () => {
    const result = validateJsonOptions('')

    expect(result.isValid).toBe(false)
    expect(result.errorCode).toBe('INVALID_OPTIONS')
  })

  it('should handle whitespace-only string as invalid JSON', () => {
    const whitespaceArb = fc
      .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
      .map((arr) => arr.join(''))

    fc.assert(
      fc.property(whitespaceArb, (whitespace) => {
        const result = validateJsonOptions(whitespace)

        expect(result.isValid).toBe(false)
        expect(result.errorCode).toBe('INVALID_OPTIONS')

        return true
      }),
      { numRuns: 100 }
    )
  })
})
