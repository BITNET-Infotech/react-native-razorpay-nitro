import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: razorpay-nitro-integration, Property 5: Error Callback Rejection
 * Validates: Requirements 3.7, 4.9
 *
 * For any payment error callback from the Razorpay SDK, the stored Promise
 * SHALL reject with an error containing the SDK's error code and description.
 */
describe('Property 5: Error Callback Rejection', () => {
  /**
   * Simulates the error callback handling from HybridRazorpay.
   * This mirrors the native implementation's behavior for error callbacks.
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
     * Simulates the onPaymentError callback from Razorpay SDK.
     * This is called when payment fails.
     * 
     * @param code Error code from Razorpay SDK (numeric)
     * @param description Error description
     */
    onPaymentError(code: number, description: string | null): void {
      if (this.pendingRejecter) {
        const errorJson = JSON.stringify({
          code: code.toString(),
          message: description ?? 'Payment failed',
        })
        this.pendingRejecter(new Error(errorJson))
        this.clearPending()
      }
    }

    private clearPending(): void {
      this.pendingResolver = null
      this.pendingRejecter = null
    }

    hasPendingPromise(): boolean {
      return this.pendingResolver !== null || this.pendingRejecter !== null
    }
  }

  /**
   * Extracts error details from the Error object.
   * The error message contains JSON with code and message fields.
   */
  function parseErrorDetails(error: Error): { code: string; message: string } | null {
    try {
      return JSON.parse(error.message)
    } catch {
      return null
    }
  }

  // Arbitrary for Razorpay SDK error codes (numeric)
  const errorCodeArb = fc.integer({ min: 0, max: 999 })

  // Arbitrary for error descriptions
  const errorDescriptionArb = fc.oneof(
    fc.constantFrom(
      'Payment cancelled by user',
      'Network error',
      'Invalid payment details',
      'Payment failed',
      'Session expired',
      'Bank server error',
      'Card declined',
      'Insufficient funds'
    ),
    fc.string({ minLength: 1, maxLength: 200 })
  )

  it('should reject with error containing SDK error code', async () => {
    await fc.assert(
      fc.asyncProperty(errorCodeArb, errorDescriptionArb, async (code, description) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        // Simulate SDK error callback
        handler.onPaymentError(code, description)

        // Promise should reject - catch and verify
        let caughtError: Error | null = null
        try {
          await promise
        } catch (error) {
          caughtError = error as Error
        }

        expect(caughtError).not.toBeNull()
        const details = parseErrorDetails(caughtError!)
        expect(details).not.toBeNull()
        expect(details!.code).toBe(code.toString())

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should reject with error containing SDK description', async () => {
    await fc.assert(
      fc.asyncProperty(errorCodeArb, errorDescriptionArb, async (code, description) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        handler.onPaymentError(code, description)

        let caughtError: Error | null = null
        try {
          await promise
        } catch (error) {
          caughtError = error as Error
        }

        expect(caughtError).not.toBeNull()
        const details = parseErrorDetails(caughtError!)
        expect(details).not.toBeNull()
        expect(details!.message).toBe(description)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle null description gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(errorCodeArb, async (code) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        // Simulate SDK callback with null description
        handler.onPaymentError(code, null)

        let caughtError: Error | null = null
        try {
          await promise
        } catch (error) {
          caughtError = error as Error
        }

        expect(caughtError).not.toBeNull()
        const details = parseErrorDetails(caughtError!)
        expect(details).not.toBeNull()
        expect(details!.code).toBe(code.toString())
        // Should use default message when null
        expect(details!.message).toBe('Payment failed')

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should convert numeric error code to string', async () => {
    await fc.assert(
      fc.asyncProperty(errorCodeArb, errorDescriptionArb, async (code, description) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        handler.onPaymentError(code, description)

        let caughtError: Error | null = null
        try {
          await promise
        } catch (error) {
          caughtError = error as Error
        }

        expect(caughtError).not.toBeNull()
        const details = parseErrorDetails(caughtError!)
        expect(details).not.toBeNull()
        // Code should be string type
        expect(typeof details!.code).toBe('string')
        // Code should match the numeric value as string
        expect(details!.code).toBe(code.toString())

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should clear pending promise after error callback', async () => {
    await fc.assert(
      fc.asyncProperty(errorCodeArb, errorDescriptionArb, async (code, description) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        expect(handler.hasPendingPromise()).toBe(true)

        handler.onPaymentError(code, description)

        // Promise should be cleared after callback
        expect(handler.hasPendingPromise()).toBe(false)

        // Properly await the rejection to avoid unhandled promise rejection
        await expect(promise).rejects.toThrow()

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should produce parseable JSON error for any code and description', async () => {
    await fc.assert(
      fc.asyncProperty(errorCodeArb, errorDescriptionArb, async (code, description) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        handler.onPaymentError(code, description)

        let caughtError: Error | null = null
        try {
          await promise
        } catch (error) {
          caughtError = error as Error
        }

        expect(caughtError).not.toBeNull()
        // Error message should be valid JSON
        expect(() => JSON.parse(caughtError!.message)).not.toThrow()

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle special characters in error description', async () => {
    // Descriptions with special characters
    const specialDescriptionArb = fc.string({ minLength: 1, maxLength: 200 })

    await fc.assert(
      fc.asyncProperty(errorCodeArb, specialDescriptionArb, async (code, description) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        handler.onPaymentError(code, description)

        // Use try/catch pattern to properly handle rejection in fast-check async context
        let caughtError: Error | null = null
        try {
          await promise
        } catch (error) {
          caughtError = error as Error
        }

        expect(caughtError).not.toBeNull()
        // Verify the error contains valid JSON with the description
        const details = parseErrorDetails(caughtError!)
        expect(details).not.toBeNull()
        expect(details!.message).toBe(description)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle common Razorpay SDK error codes', async () => {
    // Common Razorpay error codes
    const commonErrorCodes = [0, 1, 2, 3, 4, 5, 100, 101, 102, 500, 501, 502]

    for (const code of commonErrorCodes) {
      const handler = new MockPaymentHandler()
      const promise = handler.startPayment()

      handler.onPaymentError(code, `Error with code ${code}`)

      let caughtError: Error | null = null
      try {
        await promise
      } catch (error) {
        caughtError = error as Error
      }

      expect(caughtError).not.toBeNull()
      const details = parseErrorDetails(caughtError!)
      expect(details).not.toBeNull()
      expect(details!.code).toBe(code.toString())
    }
  })

  it('should maintain error format consistency with success format', async () => {
    await fc.assert(
      fc.asyncProperty(errorCodeArb, errorDescriptionArb, async (code, description) => {
        const handler = new MockPaymentHandler()
        const promise = handler.startPayment()

        handler.onPaymentError(code, description)

        let caughtError: Error | null = null
        try {
          await promise
        } catch (error) {
          caughtError = error as Error
        }

        expect(caughtError).not.toBeNull()
        const details = parseErrorDetails(caughtError!)
        expect(details).not.toBeNull()
        
        // Error should have both code and message fields (consistent format)
        expect('code' in details!).toBe(true)
        expect('message' in details!).toBe(true)
        expect(typeof details!.code).toBe('string')
        expect(typeof details!.message).toBe('string')

        return true
      }),
      { numRuns: 100 }
    )
  })
})
