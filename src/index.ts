import { NitroModules } from 'react-native-nitro-modules'
import type {
  Razorpay,
  RazorpayOptions,
  RazorpayPrefill,
  RazorpayTheme,
  RazorpayPaymentSuccess,
  RazorpayPaymentError,
} from './specs/Razorpay.nitro'

export type {
  Razorpay,
  RazorpayOptions,
  RazorpayPrefill,
  RazorpayTheme,
  RazorpayPaymentSuccess,
  RazorpayPaymentError,
}

// Types are defined inline below for complete package

// Lazy initialization of Nitro Hybrid Object
let _razorpay: Razorpay | null = null

function getRazorpayModule(): Razorpay {
  if (!_razorpay) {
    _razorpay = NitroModules.createHybridObject<Razorpay>('Razorpay')
  }
  return _razorpay
}

// External wallet callback - stored at module level for future native integration
let _walletCallback: ((data: ExternalWalletResponse) => void) | null = null

/**
 * Get the current external wallet callback (for native module integration)
 * @internal
 */
export function getExternalWalletCallback() {
  return _walletCallback
}

/**
 * RazorpayCheckout - Drop-in compatible API matching official react-native-razorpay
 * 
 * @example
 * ```typescript
 * import RazorpayCheckout from 'react-native-razorpay-nitro';
 * 
 * const options = {
 *   key: 'your_key',
 *   amount: 5000,
 *   currency: 'INR',
 *   name: 'Company Name',
 *   order_id: 'order_xxxxx',
 * };
 * 
 * // Promise-style
 * try {
 *   const data = await RazorpayCheckout.open(options);
 *   console.log('Payment ID:', data.razorpay_payment_id);
 * } catch (error) {
 *   console.log('Error:', error.description);
 * }
 * 
 * // Callback-style (optional)
 * RazorpayCheckout.open(options, 
 *   (data) => console.log('Success:', data),
 *   (error) => console.log('Error:', error)
 * );
 * ```
 */
class RazorpayCheckout {
  /**
   * Opens the Razorpay checkout with the provided options.
   * 
   * @param options - Checkout options (key, amount, currency, etc.)
   * @param successCallback - Optional callback for payment success
   * @param errorCallback - Optional callback for payment error
   * @returns Promise resolving to success response with payment_id, order_id, signature
   */
  static open(
    options: CheckoutOptions,
    successCallback?: (data: SuccessResponse) => void,
    errorCallback?: (data: ErrorResponse) => void
  ): Promise<SuccessResponse> {
    return new Promise((resolve, reject) => {
      const module = getRazorpayModule()
      
      // Convert options to JSON string for native module
      const optionsJson = JSON.stringify(options)
      
      module
        .open(optionsJson)
        .then((resultJson: string) => {
          try {
            const result = JSON.parse(resultJson) as SuccessResponse
            if (successCallback) {
              successCallback(result)
            }
            resolve(result)
          } catch (parseError) {
            const error: ErrorResponse = {
              code: -1,
              description: 'Failed to parse payment response',
            }
            if (errorCallback) {
              errorCallback(error)
            }
            reject(error)
          }
        })
        .catch((nativeError: Error) => {
          // Parse error from native module
          let error: ErrorResponse
          try {
            // Native module may return JSON error string
            const parsed = JSON.parse(nativeError.message)
            error = {
              code: typeof parsed.code === 'string' ? parseInt(parsed.code, 10) || -1 : parsed.code,
              description: parsed.message || parsed.description || nativeError.message,
            }
          } catch {
            error = {
              code: -1,
              description: nativeError.message || 'Payment failed',
            }
          }
          
          if (errorCallback) {
            errorCallback(error)
          }
          reject(error)
        })
    })
  }

  /**
   * Register a callback for external wallet selection.
   * Called when user selects an external wallet like PayTM, PhonePe, etc.
   * 
   * @param externalWalletCallback - Callback when user selects an external wallet
   * @example
   * ```typescript
   * RazorpayCheckout.onExternalWalletSelection((data) => {
   *   console.log('External wallet selected:', data.external_wallet);
   * });
   * ```
   */
  static onExternalWalletSelection(callback: (data: ExternalWalletResponse) => void): void {
    _walletCallback = callback
  }
}

/**
 * External wallet selection response
 */
export interface ExternalWalletResponse {
  external_wallet: string
  razorpay_payment_id?: string
  razorpay_order_id?: string
  razorpay_signature?: string
  [key: string]: unknown
}

// Type definitions matching official react-native-razorpay
export interface SuccessResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface ErrorResponse {
  code: number
  description: string
  error?: {
    field?: string
    source?: string
    step?: string
    reason?: string
    metadata?: {
      payment_id?: string
      order_id?: string
    }
  }
}

export interface CheckoutOptions {
  key: string
  amount: number
  currency: string
  name?: string
  description?: string
  image?: string
  order_id: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
    method?: 'card' | 'netbanking' | 'wallet' | 'emi' | 'upi'
  }
  notes?: Record<string | number, string>
  theme?: {
    hide_topbar?: boolean
    color?: string
    backdrop_color?: string
  }
  modal?: {
    backdropclose?: boolean
    escape?: boolean
    handleback?: boolean
    confirm_close?: boolean
    ondismiss?: () => void
    animation?: boolean
  }
  subscription_id?: string
  subscription_card_change?: boolean
  recurring?: boolean
  callback_url?: string
  redirect?: boolean
  customer_id?: string
  timeout?: number
  remember_customer?: boolean
  readonly?: {
    contact?: boolean
    email?: boolean
    name?: boolean
  }
  hidden?: {
    contact?: boolean
    email?: boolean
  }
  send_sms_hash?: boolean
  allow_rotation?: boolean
  retry?: {
    enabled: boolean
    max_count: number
  }
  config?: {
    display: {
      language: 'en' | 'ben' | 'hi' | 'mar' | 'guj' | 'tam' | 'tel'
    }
  }
}

// Default export for drop-in compatibility with official package
export default RazorpayCheckout

// Named export for explicit usage
export { RazorpayCheckout }
