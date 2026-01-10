# react-native-razorpay-nitro

> 💳 High-performance Razorpay payment SDK for React Native, powered by [Nitro Modules](https://nitro.margelo.com). Drop-in compatible with the official package.

<div align="center">

[![npm version](https://img.shields.io/npm/v/react-native-razorpay-nitro.svg)](https://www.npmjs.com/package/react-native-razorpay-nitro)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey.svg)]()
[![React Native](https://img.shields.io/badge/React%20Native-0.71+-brightgreen.svg)](https://reactnative.dev/)
[![Nitro Modules](https://img.shields.io/badge/Nitro%20Modules-0.31+-purple.svg)](https://nitro.margelo.com/)

[📖 Usage](#usage) • [🔄 Migration](#migration-from-react-native-razorpay) • [📚 API Reference](#api-reference)

</div>

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| ⚡️ **Nitro-Powered** | Built with Nitro Modules for ultra-low overhead native calls |
| 🏗️ **New Architecture Ready** | Full Fabric & TurboModules support out of the box |
| 📱 **16KB Page Size** | Android SDK v1.6.40 compliant with new page size requirements |
| 🍎 **Apple Silicon Native** | arm64 simulator support for M1/M2/M3/M4 Macs |
| 🔄 **Drop-in Compatible** | Same API as `react-native-razorpay` - just change the import |
| 📦 **TypeScript First** | Full type definitions with JSDoc documentation |

## 🚀 Why This Package?

The official `react-native-razorpay` package has two critical issues:
1. **No New Architecture support** - Doesn't work with Fabric/TurboModules
2. **Android 16KB page size** - Fails on devices with new memory page requirements

This package solves both while maintaining 100% API compatibility.

## 📦 Installation

```bash
npm install react-native-razorpay-nitro react-native-nitro-modules
# or
yarn add react-native-razorpay-nitro react-native-nitro-modules
# or
bun add react-native-razorpay-nitro react-native-nitro-modules
```

### iOS

```bash
cd ios && bundle exec pod install
```

> **Note:** Uses `razorpay-core-pod 1.0.4` with native arm64 simulator support.

### Android

No additional setup required. Auto-links with Razorpay SDK v1.6.40.

## 🔄 Migration from react-native-razorpay

Simply change your import - **that's it!**

```diff
- import RazorpayCheckout from 'react-native-razorpay';
+ import RazorpayCheckout from 'react-native-razorpay-nitro';
```

The API is identical. No code changes required.

## 💡 Usage

```typescript
import RazorpayCheckout from 'react-native-razorpay-nitro';

const options = {
  key: 'your_razorpay_key',
  amount: 50000, // in paise (₹500)
  currency: 'INR',
  name: 'Your Company',
  description: 'Payment for order #123',
  order_id: 'order_xxxxx', // from your backend
  prefill: {
    email: 'customer@example.com',
    contact: '9999999999',
    name: 'Customer Name',
  },
  theme: {
    color: '#F37254',
  },
};

// Promise-style (recommended)
try {
  const data = await RazorpayCheckout.open(options);
  console.log('Payment successful!');
  console.log('Payment ID:', data.razorpay_payment_id);
  console.log('Order ID:', data.razorpay_order_id);
  console.log('Signature:', data.razorpay_signature);
} catch (error) {
  console.log('Payment failed:', error.code, error.description);
}

// Callback-style (also supported)
RazorpayCheckout.open(
  options,
  (data) => console.log('Success:', data.razorpay_payment_id),
  (error) => console.log('Error:', error.code, error.description)
);
```

## 📚 API Reference

### `RazorpayCheckout.open(options, successCallback?, errorCallback?)`

Opens the Razorpay checkout modal.

**Parameters:**
- `options` - Checkout configuration object
- `successCallback` - Optional callback for success
- `errorCallback` - Optional callback for errors

**Returns:** `Promise<SuccessResponse>`

### CheckoutOptions

| Property | Type | Required | Description |
|----------|------|:--------:|-------------|
| `key` | `string` | ✅ | Your Razorpay API key |
| `amount` | `number` | ✅ | Amount in paise |
| `currency` | `string` | ✅ | Currency code (e.g., 'INR') |
| `order_id` | `string` | ✅ | Order ID from backend |
| `name` | `string` | | Business name |
| `description` | `string` | | Payment description |
| `image` | `string` | | Logo URL |
| `prefill` | `object` | | Customer details |
| `theme` | `object` | | UI customization |
| `notes` | `object` | | Additional metadata |

See [Razorpay Mobile SDK Docs](https://razorpay.com/docs/payments/payment-gateway/react-native-integration/standard/) for complete options.

### `RazorpayCheckout.onExternalWalletSelection(callback)`

Register a callback for external wallet selection (PayTM, PhonePe, etc.).

```typescript
RazorpayCheckout.onExternalWalletSelection((data) => {
  console.log('External wallet selected:', data.external_wallet);
});
```

**ExternalWalletResponse:**
```typescript
{
  external_wallet: string  // e.g., 'paytm', 'phonepe'
  razorpay_payment_id?: string
  razorpay_order_id?: string
}
```

### Response Types

```typescript
// Success
interface SuccessResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

// Error
interface ErrorResponse {
  code: number
  description: string
}
```

## 📋 Requirements

| Requirement | Version |
|-------------|---------|
| React Native | 0.71+ |
| iOS | 13.0+ |
| Android SDK | 24+ |
| react-native-nitro-modules | 0.31+ |

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue [here](https://github.com/BITNET-Infotech/react-native-razorpay-nitro/issues) first.

## ❓ Troubleshooting

**"SDK Compatibility Status" dialog on Android:**
- This dialog only appears in debug builds and is by design from Razorpay SDK
- It will NOT appear in release builds
- No action needed - this is normal behavior during development

**iOS simulator crashes on Intel Mac:**
- Uses `razorpay-core-pod 1.0.4` with arm64 support
- Run `pod install` to ensure correct version

**Payment fails silently:**
- Check that `order_id` is valid and not expired
- Verify API key matches environment (test/live)

## 📄 License

MIT
