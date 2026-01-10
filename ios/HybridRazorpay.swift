import Foundation
import UIKit
import NitroModules
import Razorpay

/**
 * HybridRazorpay - Native iOS implementation of the Razorpay Nitro Module.
 * Implements RazorpayPaymentCompletionProtocol and ExternalWalletSelectionProtocol.
 */
final class HybridRazorpay: HybridRazorpaySpec_base, HybridRazorpaySpec_protocol {
    
    // MARK: - Properties
    
    /// Closure to resolve the Promise on payment success
    private var pendingResolver: ((String) -> Void)?
    
    /// Closure to reject the Promise on payment error
    private var pendingRejecter: ((any Error) -> Void)?
    
    /// Razorpay checkout instance
    private var razorpay: RazorpayCheckout?
    
    /// Static callback for external wallet selection (shared across instances)
    private static var externalWalletCallback: ((String) -> Void)?
    
    // MARK: - Top View Controller Helper
    
    /**
     * Finds the topmost UIViewController in the view hierarchy.
     */
    private func topViewController() -> UIViewController? {
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let window = windowScene.windows.first(where: { $0.isKeyWindow }) else {
            return nil
        }
        
        var topController = window.rootViewController
        
        while let presented = topController?.presentedViewController {
            topController = presented
        }
        
        return topController
    }
    
    // MARK: - Open Method
    
    /**
     * Opens the Razorpay checkout with the provided options.
     * @param options JSON string containing RazorpayOptions
     * @returns Promise resolving to JSON string of payment success data
     */
    func open(options: String) throws -> Promise<String> {
        let promise = Promise<String>()
        
        // Check for existing payment in progress
        guard self.pendingResolver == nil else {
            promise.reject(withError: self.createNSError(code: "PAYMENT_IN_PROGRESS", message: "A payment is already in progress"))
            return promise
        }
        
        // Execute on main thread for UI operations
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                promise.reject(withError: RuntimeError.error(withMessage: "Instance deallocated"))
                return
            }
            
            // Get current view controller
            guard let viewController = self.topViewController() else {
                promise.reject(withError: self.createNSError(code: "VIEW_CONTROLLER_NOT_FOUND", message: "No view controller available to present Razorpay checkout"))
                return
            }
            
            // Parse options JSON
            guard let data = options.data(using: .utf8),
                  let optionsDict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                promise.reject(withError: self.createNSError(code: "INVALID_OPTIONS", message: "Failed to parse options"))
                return
            }
            
            // Validate required key
            guard let key = optionsDict["key"] as? String else {
                promise.reject(withError: self.createNSError(code: "INVALID_OPTIONS", message: "Missing required 'key' in options"))
                return
            }
            
            // Store promise callbacks
            self.pendingResolver = { result in
                promise.resolve(withResult: result)
            }
            self.pendingRejecter = { error in
                promise.reject(withError: error)
            }
            
            // Initialize Razorpay checkout with data delegate (preserves order_id/signature)
            self.razorpay = RazorpayCheckout.initWithKey(key, andDelegateWithData: self)
            
            // Set external wallet delegate for wallet selection support
            self.razorpay?.setExternalWalletSelectionDelegate(self)
            
            self.razorpay?.open(optionsDict, displayController: viewController)
        }
        
        return promise
    }
    
    // MARK: - External Wallet Selection Registration
    
    /**
     * Registers a callback for external wallet selection events.
     * @param callback JSON string callback when user selects an external wallet
     */
    func setExternalWalletCallback(callback: @escaping (String) -> Void) {
        HybridRazorpay.externalWalletCallback = callback
    }
    
    /**
     * Clears the external wallet callback.
     */
    func clearExternalWalletCallback() {
        HybridRazorpay.externalWalletCallback = nil
    }
    
    // MARK: - Error Helpers
    
    private func createNSError(code: String, message: String) -> NSError {
        return NSError(
            domain: "RazorpayError",
            code: 0,
            userInfo: [
                "code": code,
                "message": message
            ]
        )
    }
    
    private func clearPending() {
        pendingResolver = nil
        pendingRejecter = nil
        razorpay = nil
    }
}

// MARK: - RazorpayPaymentCompletionProtocolWithData

extension HybridRazorpay: RazorpayPaymentCompletionProtocolWithData {
    
    func onPaymentSuccess(_ payment_id: String, andData response: [AnyHashable: Any]?) {
        var result: [String: Any] = [
            "razorpay_payment_id": payment_id
        ]
        
        // Include additional data from response if available
        if let response = response {
            if let orderId = response["razorpay_order_id"] as? String {
                result["razorpay_order_id"] = orderId
            }
            if let signature = response["razorpay_signature"] as? String {
                result["razorpay_signature"] = signature
            }
        }
        
        if let data = try? JSONSerialization.data(withJSONObject: result),
           let jsonString = String(data: data, encoding: .utf8) {
            pendingResolver?(jsonString)
        } else {
            pendingResolver?("{\"razorpay_payment_id\":\"\(payment_id)\"}")
        }
        
        clearPending()
    }
    
    func onPaymentError(_ code: Int32, description str: String, andData response: [AnyHashable: Any]?) {
        pendingRejecter?(createNSError(code: String(code), message: str))
        clearPending()
    }
}

// MARK: - ExternalWalletSelectionProtocol

extension HybridRazorpay: ExternalWalletSelectionProtocol {
    
    func onExternalWalletSelected(_ walletName: String, withPaymentData paymentData: [AnyHashable: Any]?) {
        var walletInfo: [String: Any] = [
            "external_wallet": walletName
        ]
        
        // Include payment data if available
        if let paymentData = paymentData {
            for (key, value) in paymentData {
                if let stringKey = key as? String {
                    walletInfo[stringKey] = value
                }
            }
        }
        
        // Notify via static callback
        if let callback = HybridRazorpay.externalWalletCallback,
           let data = try? JSONSerialization.data(withJSONObject: walletInfo),
           let jsonString = String(data: data, encoding: .utf8) {
            callback(jsonString)
        }
    }
}

