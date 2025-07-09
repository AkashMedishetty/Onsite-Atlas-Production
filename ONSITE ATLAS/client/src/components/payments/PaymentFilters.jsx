import React, { useState } from 'react';
import { Input, Select, Button } from '../common';

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'initiated', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const providerOptions = [
  { value: '', label: 'All' },
  ...['razorpay','instamojo','stripe','phonepe','cashfree','payu','paytm','hdfc','axis','offline'].map(p=>({ value: p, label: p }))
];

const PaymentFilters = ({ onApply }) => {
  const [status,setStatus]=useState('');
  const [provider,setProvider]=useState('');
  const [search,setSearch]=useState('');

  const apply = () => onApply({ status, provider, search });

  return (
    <div className="flex items-end gap-4 mb-4">
      <Input label="Search" value={search} onChange={e=>setSearch(e.target.value)} className="w-48" />
      <Select label="Status" value={status} onChange={e=>setStatus(e.target.value)} options={statusOptions} />
      <Select label="Provider" value={provider} onChange={e=>setProvider(e.target.value)} options={providerOptions} />
      <Button onClick={apply}>Apply</Button>
    </div>
  );
};
export default PaymentFilters; 