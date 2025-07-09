import React from 'react';
import { Link } from 'react-router-dom';

const PaymentCancel = () => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-white shadow rounded-lg p-8 space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-yellow-600">Payment Cancelled</h1>
        <p>You cancelled the payment or it failed to process.</p>
        <Link to="/" className="text-indigo-600 underline">Return to Home</Link>
      </div>
    </div>
  );
};
export default PaymentCancel; 