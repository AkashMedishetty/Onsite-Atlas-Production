import React from 'react';

function formatAmount(cents) {
  return `₹ ${(cents / 100).toFixed(2)}`;
}

const PaymentTable = ({ payments, onSelect }) => {
  return (
    <div className="overflow-x-auto bg-white shadow rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-xs font-medium text-gray-500">Date</th>
            <th className="px-4 py-2 text-xs font-medium text-gray-500">Registration</th>
            <th className="px-4 py-2 text-xs font-medium text-gray-500">Provider</th>
            <th className="px-4 py-2 text-xs font-medium text-gray-500">Amount</th>
            <th className="px-4 py-2 text-xs font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 text-sm">
          {payments.map((p) => (
            <tr key={p._id} className="cursor-pointer hover:bg-gray-50" onClick={()=>onSelect && onSelect(p._id)}>
              <td className="px-4 py-2 whitespace-nowrap">{new Date(p.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2 whitespace-nowrap">{p.registration?.registrationId || '—'}</td>
              <td className="px-4 py-2 whitespace-nowrap capitalize">{p.provider}</td>
              <td className="px-4 py-2 whitespace-nowrap">{formatAmount(p.amountCents)}</td>
              <td className="px-4 py-2 whitespace-nowrap"><span className={`px-2 py-1 rounded text-white ${p.status==='paid' ? 'bg-green-500' : p.status==='failed' ? 'bg-red-500' : 'bg-yellow-500'}`}>{p.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentTable; 