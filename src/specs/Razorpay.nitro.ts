import type { HybridObject } from 'react-native-nitro-modules'

/**
 * Prefill information for the checkout form
 */
export interface RazorpayPrefill {
  email?: string
  contact?: string
  name?: string
}

/**
 * Theme customization options
 */
export interface RazorpayTheme {
  color?: string
}

/**
 * Complete checkout options matching legacy API
 */
export interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name?: string
  description?: string
  image?: string
  prefill?: RazorpayPrefill
  theme?: RazorpayTheme
  notes?: Record<string, string>
}

/**
 * Payment success response
 */
export interface RazorpayPaymentSuccess {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

/**
 * Payment error response
 */
export interface RazorpayPaymentError {
  code: string
  message: string
}

/**
 * HybridRazorpay - Nitro Module for Razorpay payments
 */
export interface Razorpay
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Opens the Razorpay checkout with the provided options
   * @param options - JSON string of RazorpayOptions
   * @returns Promise resolving to JSON string of RazorpayPaymentSuccess
   * @throws RazorpayPaymentError as JSON string on failure
   */
  open(options: string): Promise<string>
}
