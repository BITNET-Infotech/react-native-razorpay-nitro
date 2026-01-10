package com.margelo.nitro.razorpaynitro

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.razorpay.Checkout
import org.json.JSONObject

/**
 * HybridRazorpay - Native Android implementation of the Razorpay Nitro Module.
 * Uses RazorpayPaymentActivity to handle payment callbacks properly.
 * Supports external wallet selection callbacks.
 */
class HybridRazorpay : HybridRazorpaySpec(), ActivityEventListener {

    // Store the pending promise for callback resolution
    private var pendingPromise: Promise<String>? = null

    companion object {
        private const val TAG = "HybridRazorpay"
        private const val REQUEST_CODE_RAZORPAY = 1001
        
        // Static callback for external wallet selection (shared across instances)
        private var externalWalletCallback: ((String) -> Unit)? = null
        
        /**
         * Sets the external wallet callback from JS layer.
         */
        fun setExternalWalletCallback(callback: ((String) -> Unit)?) {
            externalWalletCallback = callback
        }
    }

    init {
        NitroModules.applicationContext?.addActivityEventListener(this)
    }

    /**
     * Opens the Razorpay checkout with the provided options.
     */
    override fun open(options: String): Promise<String> {
        // Check for existing payment in progress
        if (pendingPromise != null) {
            return Promise.rejected(
                Exception(createError("PAYMENT_IN_PROGRESS", "A payment is already in progress"))
            )
        }

        // Get current activity
        val activity = NitroModules.applicationContext?.currentActivity
        if (activity == null) {
            return Promise.rejected(
                Exception(createError("ACTIVITY_NOT_FOUND", "No activity available to present Razorpay checkout"))
            )
        }

        // Validate options JSON
        try {
            JSONObject(options)
        } catch (e: Exception) {
            return Promise.rejected(
                Exception(createError("INVALID_OPTIONS", "Failed to parse options: ${e.message}"))
            )
        }

        // Create promise and store for callback resolution
        val promise = Promise<String>()
        pendingPromise = promise

        // Launch RazorpayPaymentActivity
        try {
            val intent = Intent(activity, RazorpayPaymentActivity::class.java).apply {
                putExtra(RazorpayPaymentActivity.EXTRA_OPTIONS, options)
            }
            activity.startActivityForResult(intent, REQUEST_CODE_RAZORPAY)
        } catch (e: Exception) {
            pendingPromise = null
            return Promise.rejected(
                Exception(createError("CHECKOUT_ERROR", "Failed to start payment activity: ${e.message}"))
            )
        }

        return promise
    }

    /**
     * Called when an activity returns a result.
     */
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE_RAZORPAY) return
        
        when (resultCode) {
            RazorpayPaymentActivity.RESULT_PAYMENT_SUCCESS -> {
                val promise = pendingPromise ?: return
                pendingPromise = null
                
                val paymentId = data?.getStringExtra(RazorpayPaymentActivity.EXTRA_PAYMENT_ID) ?: ""
                val orderId = data?.getStringExtra(RazorpayPaymentActivity.EXTRA_ORDER_ID) ?: ""
                val signature = data?.getStringExtra(RazorpayPaymentActivity.EXTRA_SIGNATURE) ?: ""
                
                val result = JSONObject().apply {
                    put("razorpay_payment_id", paymentId)
                    put("razorpay_order_id", orderId)
                    put("razorpay_signature", signature)
                }
                
                promise.resolve(result.toString())
            }
            RazorpayPaymentActivity.RESULT_PAYMENT_ERROR -> {
                val promise = pendingPromise ?: return
                pendingPromise = null
                
                val errorCode = data?.getIntExtra(RazorpayPaymentActivity.EXTRA_ERROR_CODE, -1) ?: -1
                val errorDescription = data?.getStringExtra(RazorpayPaymentActivity.EXTRA_ERROR_DESCRIPTION) 
                    ?: "Payment failed or cancelled"
                
                promise.reject(Exception(createError(errorCode.toString(), errorDescription)))
            }
            RazorpayPaymentActivity.RESULT_EXTERNAL_WALLET -> {
                // External wallet selected - call the callback but don't resolve promise yet
                val walletData = data?.getStringExtra(RazorpayPaymentActivity.EXTRA_WALLET_DATA) ?: "{}"
                externalWalletCallback?.invoke(walletData)
                // Don't clear pendingPromise - payment flow continues after wallet selection
            }
            Activity.RESULT_CANCELED -> {
                val promise = pendingPromise ?: return
                pendingPromise = null
                promise.reject(Exception(createError("0", "Payment cancelled by user")))
            }
            else -> {
                val promise = pendingPromise ?: return
                pendingPromise = null
                promise.reject(Exception(createError("-1", "Unknown payment result")))
            }
        }
    }

    /**
     * Called when a new intent is received.
     */
    override fun onNewIntent(intent: Intent) {
        // Not used for Razorpay
    }

    /**
     * Creates a JSON error string with code and message fields.
     */
    private fun createError(code: String, message: String): String {
        return JSONObject().apply {
            put("code", code)
            put("message", message)
        }.toString()
    }
}
