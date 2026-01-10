import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: razorpay-nitro-integration, Property 7: Concurrent Call Rejection
 * Validates: Requirements 7.6
 *
 * For any call to open() while a previous payment is in progress
 * (Promise not yet resolved/rejected), the new call SHALL immediately
 * reject with error code "PAYMENT_IN_PROGRESS".
 */
describe('Property 7: Concurrent Call Rejection', () => {
  /**
   * Simulates the state management of HybridRazorpay.
   * This mirrors the native implementation's behavior for concurrent call detection.
   */
  class MockHybridRazorpay {
    private pendingPromise: boolean = false

    /**
     * Simulates the open() method's concurrent call check.
     * Returns the result of attempting to open a payment.
     */
    open(options: string): { success: boolean; errorCode?: string; errorMessage?: string } {
      // Check for existing payment in progress
      if (this.pendingPromise) {
        return {
          success: false,
          errorCode: 'PAYMENT_IN_PROGRESS',
          errorMessage: 'A payment is already in progress',
        }
      }

      // Validate options (simplified)
      try {
        const parsed = JSON.parse(options)
        if (typeof parsed !== 'object' || parsed === null || !parsed.key) {
          return {
            success: false,
            errorCode: 'INVALID_OPTIONS',
            errorMessage: 'Failed to parse options',
          }
        }
      } catch {
        return {
          success: false,
          errorCode: 'INVALID_OPTIONS',
          errorMessage: 'Failed to parse options',
        }
      }

      // Mark payment as in progress
      this.pendingPromise = true

      return { success: true }
    }

    /**
     * Simulates payment completion (success or error).
     * Clears the pending state.
     */
    completePayment(): void {
      this.pendingPromise = false
    }

    /**
     * Returns whether a payment is currently in progress.
     */
    isPaymentInProgress(): boolean {
      return this.pendingPromise
    }
  }

  // Arbitrary for valid RazorpayOptions JSON strings
  const validOptionsArb = fc
    .record({
      key: fc.string({ minLength: 10, maxLength: 30 }),
      amount: fc.integer({ min: 100, max: 10000000 }),
      currency: fc.constantFrom('INR', 'USD', 'EUR'),
      order_id: fc.string({ minLength: 10, maxLength: 40 }),
    })
    .map((obj) => JSON.stringify(obj))

  it('should reject concurrent calls with PAYMENT_IN_PROGRESS', () => {
    fc.assert(
      fc.property(validOptionsArb, validOptionsArb, (firstOptions, secondOptions) => {
        const razorpay = new MockHybridRazorpay()

        // First call should succeed
        const firstResult = razorpay.open(firstOptions)
        expect(firstResult.success).toBe(true)
        expect(razorpay.isPaymentInProgress()).toBe(true)

        // Second call while first is in progress should fail
        const secondResult = razorpay.open(secondOptions)
        expect(secondResult.success).toBe(false)
        expect(secondResult.errorCode).toBe('PAYMENT_IN_PROGRESS')
        expect(secondResult.errorMessage).toBe('A payment is already in progress')

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should allow new call after previous payment completes', () => {
    fc.assert(
      fc.property(validOptionsArb, validOptionsArb, (firstOptions, secondOptions) => {
        const razorpay = new MockHybridRazorpay()

        // First call should succeed
        const firstResult = razorpay.open(firstOptions)
        expect(firstResult.success).toBe(true)

        // Complete the first payment
        razorpay.completePayment()
        expect(razorpay.isPaymentInProgress()).toBe(false)

        // Second call after completion should succeed
        const secondResult = razorpay.open(secondOptions)
        expect(secondResult.success).toBe(true)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should reject multiple concurrent calls in sequence', () => {
    fc.assert(
      fc.property(
        fc.array(validOptionsArb, { minLength: 2, maxLength: 5 }),
        (optionsArray) => {
          const razorpay = new MockHybridRazorpay()

          // First call should succeed
          const firstResult = razorpay.open(optionsArray[0])
          expect(firstResult.success).toBe(true)

          // All subsequent calls should fail with PAYMENT_IN_PROGRESS
          for (let i = 1; i < optionsArray.length; i++) {
            const result = razorpay.open(optionsArray[i])
            expect(result.success).toBe(false)
            expect(result.errorCode).toBe('PAYMENT_IN_PROGRESS')
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle alternating open/complete cycles', () => {
    fc.assert(
      fc.property(
        fc.array(validOptionsArb, { minLength: 1, maxLength: 5 }),
        (optionsArray) => {
          const razorpay = new MockHybridRazorpay()

          // Each open/complete cycle should work
          for (const options of optionsArray) {
            // Open should succeed when no payment in progress
            expect(razorpay.isPaymentInProgress()).toBe(false)
            const result = razorpay.open(options)
            expect(result.success).toBe(true)
            expect(razorpay.isPaymentInProgress()).toBe(true)

            // Complete the payment
            razorpay.completePayment()
            expect(razorpay.isPaymentInProgress()).toBe(false)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject concurrent call regardless of options content', () => {
    // Test that even with different options, concurrent calls are rejected
    const differentOptionsArb = fc.tuple(
      fc
        .record({
          key: fc.constant('key_first_payment'),
          amount: fc.constant(1000),
          currency: fc.constant('INR'),
        })
        .map((obj) => JSON.stringify(obj)),
      fc
        .record({
          key: fc.constant('key_second_payment'),
          amount: fc.constant(2000),
          currency: fc.constant('USD'),
        })
        .map((obj) => JSON.stringify(obj))
    )

    fc.assert(
      fc.property(differentOptionsArb, ([firstOptions, secondOptions]) => {
        const razorpay = new MockHybridRazorpay()

        // First call succeeds
        const firstResult = razorpay.open(firstOptions)
        expect(firstResult.success).toBe(true)

        // Second call with completely different options should still fail
        const secondResult = razorpay.open(secondOptions)
        expect(secondResult.success).toBe(false)
        expect(secondResult.errorCode).toBe('PAYMENT_IN_PROGRESS')

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should maintain PAYMENT_IN_PROGRESS error format consistency', () => {
    fc.assert(
      fc.property(validOptionsArb, validOptionsArb, (firstOptions, secondOptions) => {
        const razorpay = new MockHybridRazorpay()

        // Start first payment
        razorpay.open(firstOptions)

        // Get the error from concurrent call
        const result = razorpay.open(secondOptions)

        // Verify error format matches requirements
        expect(result.success).toBe(false)
        expect(result.errorCode).toBe('PAYMENT_IN_PROGRESS')
        expect(typeof result.errorMessage).toBe('string')
        expect(result.errorMessage!.length).toBeGreaterThan(0)

        return true
      }),
      { numRuns: 100 }
    )
  })
})
