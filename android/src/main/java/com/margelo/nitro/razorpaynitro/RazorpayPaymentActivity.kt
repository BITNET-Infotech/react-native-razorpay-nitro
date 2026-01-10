package com.margelo.nitro.razorpaynitro

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.razorpay.Checkout
import com.razorpay.ExternalWalletListener
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import org.json.JSONObject

/**
 * Transparent Activity that handles Razorpay payment callbacks.
 * This is needed because Razorpay SDK requires the Activity to implement PaymentResultWithDataListener.
 * Also implements ExternalWalletListener for external wallet selection support.
 * 
 * Note: The SDK compatibility check dialog appears only in debug builds.
 * It will not appear in release builds. This is by design from Razorpay SDK.
 */
class RazorpayPaymentActivity : Activity(), PaymentResultWithDataListener, ExternalWalletListener {

    companion object {
        const val EXTRA_OPTIONS = "razorpay_options"
        const val RESULT_PAYMENT_SUCCESS = 1
        const val RESULT_PAYMENT_ERROR = 2
        const val RESULT_EXTERNAL_WALLET = 3
        
        const val EXTRA_PAYMENT_ID = "payment_id"
        const val EXTRA_ORDER_ID = "order_id"
        const val EXTRA_SIGNATURE = "signature"
        const val EXTRA_ERROR_CODE = "error_code"
        const val EXTRA_ERROR_DESCRIPTION = "error_description"
        const val EXTRA_WALLET_NAME = "wallet_name"
        const val EXTRA_WALLET_DATA = "wallet_data"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val optionsString = intent.getStringExtra(EXTRA_OPTIONS)
        if (optionsString == null) {
            setResult(RESULT_CANCELED)
            finish()
            return
        }

        try {
            val optionsJson = JSONObject(optionsString)
            
            val checkout = Checkout()
            
            val key = optionsJson.optString("key", "")
            if (key.isNotEmpty()) {
                checkout.setKeyID(key)
            }
            
            checkout.open(this, optionsJson)
        } catch (e: Exception) {
            val resultIntent = Intent().apply {
                putExtra(EXTRA_ERROR_CODE, -1)
                putExtra(EXTRA_ERROR_DESCRIPTION, "Failed to open checkout: ${e.message}")
            }
            setResult(RESULT_PAYMENT_ERROR, resultIntent)
            finish()
        }
    }

    override fun onPaymentSuccess(razorpayPaymentID: String?, paymentData: PaymentData?) {
        val resultIntent = Intent().apply {
            putExtra(EXTRA_PAYMENT_ID, paymentData?.paymentId ?: razorpayPaymentID ?: "")
            putExtra(EXTRA_ORDER_ID, paymentData?.orderId ?: "")
            putExtra(EXTRA_SIGNATURE, paymentData?.signature ?: "")
        }
        setResult(RESULT_PAYMENT_SUCCESS, resultIntent)
        finish()
    }

    override fun onPaymentError(code: Int, description: String?, paymentData: PaymentData?) {
        val resultIntent = Intent().apply {
            putExtra(EXTRA_ERROR_CODE, code)
            putExtra(EXTRA_ERROR_DESCRIPTION, description ?: "Payment failed")
        }
        setResult(RESULT_PAYMENT_ERROR, resultIntent)
        finish()
    }

    override fun onExternalWalletSelected(walletName: String?, paymentData: PaymentData?) {
        val walletData = JSONObject().apply {
            put("external_wallet", walletName ?: "")
            paymentData?.let { data ->
                data.paymentId?.let { put("razorpay_payment_id", it) }
                data.orderId?.let { put("razorpay_order_id", it) }
                data.signature?.let { put("razorpay_signature", it) }
            }
        }
        
        val resultIntent = Intent().apply {
            putExtra(EXTRA_WALLET_NAME, walletName ?: "")
            putExtra(EXTRA_WALLET_DATA, walletData.toString())
        }
        setResult(RESULT_EXTERNAL_WALLET, resultIntent)
        // Don't finish - let the external wallet flow continue
    }
    
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val resultIntent = Intent().apply {
            putExtra(EXTRA_ERROR_CODE, 0)
            putExtra(EXTRA_ERROR_DESCRIPTION, "Payment cancelled by user")
        }
        setResult(RESULT_PAYMENT_ERROR, resultIntent)
        super.onBackPressed()
    }
}
