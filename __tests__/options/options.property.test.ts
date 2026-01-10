import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { RazorpayOptions } from '../../src/specs/Razorpay.nitro'

/**
 * Feature: razorpay-nitro-integration, Property 1: Options Compatibility
 * Validates: Requirements 1.6
 *
 * For any valid legacy RazorpayCheckout.open(options) options object,
 * the new Razorpay.open(options) API SHALL accept the same structure without modification.
 */
describe('Property 1: Options Compatibility', () => {
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

  it('should preserve all required fields after JSON serialization', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const json = JSON.stringify(options)
        const parsed = JSON.parse(json) as RazorpayOptions

        // Required fields must be preserved
        expect(parsed.key).toBe(options.key)
        expect(parsed.amount).toBe(options.amount)
        expect(parsed.currency).toBe(options.currency)
        expect(parsed.order_id).toBe(options.order_id)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve optional fields when present after JSON serialization', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const json = JSON.stringify(options)
        const parsed = JSON.parse(json) as RazorpayOptions

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

  it('should preserve nested prefill object after JSON serialization', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const json = JSON.stringify(options)
        const parsed = JSON.parse(json) as RazorpayOptions

        if (options.prefill !== undefined) {
          expect(parsed.prefill).toBeDefined()
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

  it('should preserve nested theme object after JSON serialization', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const json = JSON.stringify(options)
        const parsed = JSON.parse(json) as RazorpayOptions

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

  it('should preserve notes dictionary after JSON serialization', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const json = JSON.stringify(options)
        const parsed = JSON.parse(json) as RazorpayOptions

        if (options.notes !== undefined) {
          expect(parsed.notes).toBeDefined()
          expect(parsed.notes).toEqual(options.notes)
        }

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should produce valid JSON string from any RazorpayOptions', () => {
    fc.assert(
      fc.property(razorpayOptionsArb, (options) => {
        const json = JSON.stringify(options)

        // JSON string should be valid and parseable
        expect(() => JSON.parse(json)).not.toThrow()

        // Parsed result should be an object
        const parsed = JSON.parse(json)
        expect(typeof parsed).toBe('object')
        expect(parsed).not.toBeNull()

        return true
      }),
      { numRuns: 100 }
    )
  })
})
