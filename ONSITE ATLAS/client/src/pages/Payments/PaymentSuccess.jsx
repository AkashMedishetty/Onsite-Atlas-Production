import React from 'react';
import { Link } from 'react-router-dom';

const PaymentSuccess = () => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-white shadow rounded-lg p-8 space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-green-600">Payment Successful!</h1>
        <p>Thank you for your payment. A confirmation email and invoice will be sent to you shortly.</p>
        <Link to="/" className="text-indigo-600 underline">Go to Home</Link>
      </div>
    </div>
  );
};
export default PaymentSuccess; 