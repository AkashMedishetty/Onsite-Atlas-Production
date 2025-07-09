const RazorpayProvider = require('./providers/RazorpayProvider');
const InstamojoProvider = require('./providers/InstamojoProvider');
const StripeProvider = require('./providers/StripeProvider');
const StubProvider = require('./providers/StubProvider');
const PhonePeProvider = require('./providers/PhonePeProvider');
const CashfreeProvider = require('./providers/CashfreeProvider');
const PayUProvider = require('./providers/PayUProvider');
const PaytmProvider = require('./providers/PaytmProvider');
// Future: StripeProvider, PhonePeProvider, etc.

module.exports = {
  razorpay: RazorpayProvider,
  instamojo: InstamojoProvider,
  stripe: StripeProvider,
  phonepe: PhonePeProvider,
  cashfree: CashfreeProvider,
  payu: PayUProvider,
  paytm: PaytmProvider,
  hdfc: PayUProvider,
  axis: PayUProvider,
}; 