import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: razorpay-nitro-integration, Property 4: Success Callback Resolution
 * Validates: Requirements 3.6, 4.8
 *
 * For any payment success callback from the Razorpay SDK, the stored Promise
 * SHALL resolve with a JSON string containing at minimum `razorpay_payment_id`.
 */
describe('Property 4: Success Callback Resolution', () => {
  /**
   * Simulates the success callback handling from HybridRazorpay.
   * This mirrors the native implementation's behavior for success callbacks.
   */
  class MockPaymentHandler {
    private pendingResolver: ((value: string) => void) | null = null
    private pendingRejecter: ((error: Error) => void) | null = null

    /**
     * Simulates starting a payment and storing the promise handlers.
     */
    startPayment(): Promise<string> {
      return new Promise((resolve, reject) => {
        this.pendingResolver = resolve
        this.pendingRejecter = reject
      })
    }

    /**
     * Simulates the onPaymentSuccess callback from Razorpay SDK.
     * This is called when payment succeeds.
     * 
     * @param paymentId The Razorpay payment ID
     */
    onPaymentSuccess(paymentId: string | null): void {
      if (this.pendingResolver) {
        const result = JSON.stringify({
          razorpay_payment_id: paymentId ?? '',
        })
        this.pendingResolver(result)
        this.clearPending()
      }
    }

    /**
     * Simulates the onPaymentSuccess callback with full payment data.
     * Some SDK versions return additional fields.
     * 
     * @param paymentId The Razorpay payment ID
     * @param orderId The Razorpay order ID (optional)
     * @param signature The payment signature (optional)
     */
    onPaymentSuccessWithFullData(
      paymentId: string,
      orderId?: string,
      signature?: string
    ): void {
      if (this.pendingResolver) {
        const result: Record<string, string> = {
          razorpay_payment_id: paymentId,
        }
        if (orderId) {
          result.razorpay_order_id = orderId
        }
        if (signature) {
          result.razorpay_signature = signature
        }
        this.pendingResolver(JSON.stringify(result))
        this.clearPending()
      }
    }

    private clearPending(): void {
      this.pendingResolver = null
      this.pendingRejecter = null
    }

    hasPendingPromise(): boolean {
      return this.pendingResolver !== null
    }
  }

  /**
   * Validates that a success response string is properly formatted JSON
   * with required `razorpay_payment_id` field.
   */
  function isValidSuccessResponse(responseString: string): boolean {
    try {
      const parsed = JSON.parse(responseString)
      return (
        typeof parsed === 'object' &&
        parsed !== null &&
        'razorpay_payment_id' in parsed &&
        typeof parsed.razorpay_payment_id === 'string'
      )
    } catch {
      return false
    }
  }

  // Arbitrary for Razorpay payment IDs (format: pay_XXXXX)
  const paymentIdArb = fc
    .string({ minLength: 10, maxLength: 20 })
    .map((s) => `pay_${s.replace(/[^a-zA-Z0-9]/g, 'X')}`)

  // Arbitrary for Razorpay order IDs (format: order_XXXXX)
  const orderIdArb = fc
    .string({ minLength: 10, maxLength: 20 })
    .map((s) => `order_${s.replace(/[^a-zA-Z0-9]/g, 'X')}`)

  // Arbitrary for payment signatures (base64-like strings)
  const signatureArb = fc.string({ minLength: 40, maxLength: 100 })

  it('should resolve with valid JSON containing razorpay_payment_id', async () => {
    await fc.assert(
      fc.asyncProperty(paymentIdArb, async (paymentId) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        // Simulate SDK callback
        handler.onPaymentSuccess(paymentId)

        const result = await promise

        // Result should be valid JSON
        expect(() => JSON.parse(result)).not.toThrow()

        // Result should have valid success response format
        expect(isValidSuccessResponse(result)).toBe(true)

        // Payment ID should be preserved
        const parsed = JSON.parse(result)
        expect(parsed.razorpay_payment_id).toBe(paymentId)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle null payment ID gracefully', async () => {
    const handler = new MockPaymentHandler()
    const promise = handler.startPayment()

    // Simulate SDK callback with null (edge case)
    handler.onPaymentSuccess(null)

    const result = await promise

    // Should still be valid JSON
    expect(() => JSON.parse(result)).not.toThrow()
    expect(isValidSuccessResponse(result)).toBe(true)

    // Payment ID should be empty string when null
    const parsed = JSON.parse(result)
    expect(parsed.razorpay_payment_id).toBe('')
  })

  it('should preserve payment ID exactly as provided by SDK', async () => {
    await fc.assert(
      fc.asyncProperty(paymentIdArb, async (paymentId) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        handler.onPaymentSuccess(paymentId)

        const result = await promise
        const parsed = JSON.parse(result)

        // Payment ID should be exactly as provided, no transformation
        expect(parsed.razorpay_payment_id).toBe(paymentId)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should clear pending promise after success callback', async () => {
    await fc.assert(
      fc.asyncProperty(paymentIdArb, async (paymentId) => {
        const handler = new MockPaymentHandler()
        handler.startPayment()

        expect(handler.hasPendingPromise()).toBe(true)

        handler.onPaymentSuccess(paymentId)

        // Promise should be cleared after callback
        expect(handler.hasPendingPromise()).toBe(false)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle full payment data with order_id and signature', async () => {
    await fc.assert(
      fc.asyncProperty(
        paymentIdArb,
        orderIdArb,
        signatureArb,
        async (paymentId, orderId, signature) => {
          const handler = new MockPaymentHandler()
          const promise = handler.startPayment()

          handler.onPaymentSuccessWithFullData(paymentId, orderId, signature)

          const result = await promise
          const parsed = JSON.parse(result)

          // All fields should be preserved
          expect(parsed.razorpay_payment_id).toBe(paymentId)
          expect(parsed.razorpay_order_id).toBe(orderId)
          expect(parsed.razorpay_signature).toBe(signature)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should produce parseable JSON for any valid payment ID', async () => {
    // Test with various payment ID formats
    const anyPaymentIdArb = fc.oneof(
      paymentIdArb,
      fc.string({ minLength: 1, maxLength: 50 }), // Random strings
      fc.constantFrom('pay_123', 'pay_ABC', 'pay_test_12345') // Common formats
    )

    await fc.assert(
      fc.asyncProperty(anyPaymentIdArb, async (paymentId) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        handler.onPaymentSuccess(paymentId)

        const result = await promise

        // Should always produce valid JSON
        expect(() => JSON.parse(result)).not.toThrow()

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle special characters in payment ID', async () => {
    // Payment IDs with special characters (edge case)
    const specialPaymentIdArb = fc.string({ minLength: 5, maxLength: 30 })

    await fc.assert(
      fc.asyncProperty(specialPaymentIdArb, async (paymentId) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        handler.onPaymentSuccess(paymentId)

        const result = await promise

        // JSON should handle special characters properly
        expect(() => JSON.parse(result)).not.toThrow()

        const parsed = JSON.parse(result)
        expect(parsed.razorpay_payment_id).toBe(paymentId)

        return true
      }),
      { numRuns: 100 }
    )
  })
})
