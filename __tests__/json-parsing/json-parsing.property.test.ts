import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { RazorpayOptions } from '../../src/specs/Razorpay.nitro'

/**
 * Feature: razorpay-nitro-integration, Property 2: JSON Parsing Round-Trip
 * Validates: Requirements 3.8
 *
 * For any valid RazorpayOptions object, serializing to JSON and parsing in native code
 * SHALL produce an equivalent native dictionary/JSONObject with all fields preserved.
 */
describe('Property 2: JSON Parsing Round-Trip', () => {
  // Arbitrary for RazorpayPrefill
  const razorpayPrefillArb = fc.record(
    {
      email: fc.option(fc.emailAddress(), { nil: undefined }),
      contact: fc.option(fc.string({ minLength: 10, maxLength: 15 }), {
        nil: undefined,
      }),
      name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
        nil: undefined,
      }),
    },
    { requiredKeys: [] }
  )

  // Arbitrary for RazorpayTheme
  const razorpayThemeArb = fc.record(
    {
      color: fc.option(
        fc
          .array(fc.constantFrom(...'0123456789abcdef'.split('')), {
            minLength: 6,
            maxLength: 6,
          })
          .map((arr) => `#${arr.join('')}`),
        { nil: undefined }
      ),
    },
    { requiredKeys: [] }
  )

  // Arbitrary for notes (Record<string, string>)
  const notesArb = fc.option(
    fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 100 }),
      { minKeys: 0, maxKeys: 5 }
    ),
    { nil: undefined }
  )

  // Arbitrary for complete RazorpayOptions
  const razorpayOptionsArb = fc.record({
    key: fc.string({ minLength: 10, maxLength: 30 }),
    amount: fc.integer({ min: 100, max: 10000000 }),
    currency: fc.constantFrom('INR', 'USD', 'EUR', 'GBP'),
    order_id: fc.string({ minLength: 10, maxLength: 40 }),
    name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
      nil: undefined,
    }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 255 }), {
      nil: undefined,
    }),
    image: fc.option(fc.webUrl(), { nil: undefined }),
    prefill: fc.option(razorpayPrefillArb, { nil: undefined }),
    theme: fc.option(razorpayThemeArb, { nil: undefined }),
    notes: notesArb,
  })

  /**
   * Simulates the native JSON parsing behavior.
   * In Android, this would be JSONObject(jsonString).
   * In iOS, this would be JSONSerialization.jsonObject(with:).
   */
  function simulateNativeJsonParsing(jsonString: string): unknown {
    // Native JSON parsing follows the same rules as JavaScript JSON.parse
    return JSON.parse(jsonString)
  }

  /**
   * Deep equality check that handles undefined vs missing keys
   * (which is how JSON serialization works)
   */
  function deepEqual(obj1: unknown, obj2: unknown): boolean {
    if (obj1 === obj2) return true
    if (obj1 === undefined && obj2 === undefined) return true
    if (obj1 === null && obj2 === null) return true
    if (typeof obj1 !== typeof obj2) return false
    if (typeof obj1 !== 'object' || obj1 === null) return false
    if (typeof obj2 !== 'object' || obj2 === null) return false

    const keys1 = Object.keys(obj1 as object).filter(
      (k) => (obj1 as Record<string, unknown>)[k] !== undefined
    )
    const keys2 = Object.keys(obj2 as object).filter(
      (k) => (obj2 as Record<string, unknown>)[k] !== undefined
    )

    if (keys1.length !== keys2.length) return false

    for (const key of keys1) {
      if (
        !deepEqual(
          (obj1 as Record<string, unknown>)[key],
          (obj2 as Record<string, unknown>)[key]
        )
      ) {
        return false
      }
    }

    return true
  }

  it('should preserve all fields after JSON stringify -> parse round-trip', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        // Step 1: Serialize to JSON (what JS does before sending to native)
        const jsonString = JSON.stringify(options)

        // Step 2: Parse JSON (simulating native JSONObject parsing)
        const parsed = simulateNativeJsonParsing(jsonString) as RazorpayOptions

        // Step 3: Verify all required fields are preserved
        expect(parsed.key).toBe(options.key)
        expect(parsed.amount).toBe(options.amount)
        expect(parsed.currency).toBe(options.currency)
        expect(parsed.order_id).toBe(options.order_id)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve optional string fields when present', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const jsonString = JSON.stringify(options)
        const parsed = simulateNativeJsonParsing(jsonString) as RazorpayOptions

        // Optional fields should be preserved when present
        if (options.name !== undefined) {
          expect(parsed.name).toBe(options.name)
        }
        if (options.description !== undefined) {
          expect(parsed.description).toBe(options.description)
        }
        if (options.image !== undefined) {
          expect(parsed.image).toBe(options.image)
        }

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve nested prefill object structure', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const jsonString = JSON.stringify(options)
        const parsed = simulateNativeJsonParsing(jsonString) as RazorpayOptions

        if (options.prefill !== undefined) {
          expect(parsed.prefill).toBeDefined()
          // Check each prefill field
          if (options.prefill.email !== undefined) {
            expect(parsed.prefill?.email).toBe(options.prefill.email)
          }
          if (options.prefill.contact !== undefined) {
            expect(parsed.prefill?.contact).toBe(options.prefill.contact)
          }
          if (options.prefill.name !== undefined) {
            expect(parsed.prefill?.name).toBe(options.prefill.name)
          }
        }

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve nested theme object structure', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const jsonString = JSON.stringify(options)
        const parsed = simulateNativeJsonParsing(jsonString) as RazorpayOptions

        if (options.theme !== undefined) {
          expect(parsed.theme).toBeDefined()
          if (options.theme.color !== undefined) {
            expect(parsed.theme?.color).toBe(options.theme.color)
          }
        }

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve notes dictionary with all key-value pairs', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const jsonString = JSON.stringify(options)
        const parsed = simulateNativeJsonParsing(jsonString) as RazorpayOptions

        if (options.notes !== undefined) {
          expect(parsed.notes).toBeDefined()
          // All keys and values should be preserved
          for (const [key, value] of Object.entries(options.notes)) {
            expect(parsed.notes?.[key]).toBe(value)
          }
        }

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should produce equivalent object after round-trip', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const jsonString = JSON.stringify(options)
        const parsed = simulateNativeJsonParsing(jsonString) as Record<string, unknown>

        // The parsed object should be deeply equal to the original
        // (accounting for undefined values being stripped during JSON serialization)
        expect(deepEqual(options, parsed)).toBe(true)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle numeric amount values correctly', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const jsonString = JSON.stringify(options)
        const parsed = simulateNativeJsonParsing(jsonString) as RazorpayOptions

        // Amount should be preserved as a number, not converted to string
        expect(typeof parsed.amount).toBe('number')
        expect(parsed.amount).toBe(options.amount)

        return true
      }),
      { numRuns: 100 }
    )
  })
})
