import React from 'react';

function formatAmount(cents) {
  return `₹ ${(cents / 100).toFixed(2)}`;
}

const Card = ({ title, value }) => (
  <div className="bg-white shadow rounded-lg p-4 text-center flex-1">
    <div className="text-sm text-gray-500 mb-1">{title}</div>
    <div className="text-xl font-bold">{value}</div>
  </div>
);

const PaymentSummaryCards = ({ payments }) => {
  const totalAmount = payments.reduce((acc, p) => acc + (p.amountCents || 0), 0);
  const paidAmount = payments.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amountCents, 0);
  const pendingAmount = payments.filter((p) => p.status === 'initiated').reduce((a, p) => a + p.amountCents, 0);
  const failedCount = payments.filter((p) => p.status === 'failed').length;

  return (
    <div className="flex gap-4 mb-6">
      <Card title="Total Collected" value={formatAmount(paidAmount)} />
      <Card title="Pending" value={formatAmount(pendingAmount)} />
      <Card title="Attempts" value={payments.length} />
      <Card title="Failed" value={failedCount} />
    </div>
  );
};

export default PaymentSummaryCards; 