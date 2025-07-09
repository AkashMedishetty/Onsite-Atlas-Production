import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import registrationService from '../../services/registrationService';

const statusColors={
  exempt:'bg-gray-400 text-white',
  pending:'bg-amber-500 text-white',
  paid:'bg-green-600 text-white'
};

const PaymentBadge=({status})=>{
  const cls=statusColors[status]||'bg-gray-200 text-gray-800';
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{status.toUpperCase()}</span>;
};

const RegistrationsPage = () => {
  const { eventId } = useParams();
  const [regs,setRegs]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!eventId) return;
    (async()=>{
      setLoading(true);
      const res=await registrationService.getRegistrations(eventId,{ limit:100 });
      const data=res.data?.data||res.data||[];
      setRegs(data);
      setLoading(false);
    })();
  },[eventId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Registrations</h1>
        <div className="flex space-x-2">
          <Link 
            to={`/events/${eventId}/registrations/new`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Registration
          </Link>
        </div>
      </div>
      <div className="bg-white shadow rounded-lg p-6 overflow-x-auto">
        {loading?(
          <p>Loading…</p>
        ):(
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Reg ID','Name','Category','Payment'].map(h=>(<th key={h} className="px-4 py-2 text-left font-medium text-gray-600">{h}</th>))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {regs.map(r=>{
                const payStatus = r.paymentStatus==='paid'?'paid':(r.paymentRequired===false?'exempt':'pending');
                return (
                  <tr key={r._id}>
                    <td className="px-4 py-1 whitespace-nowrap">{r.registrationId}</td>
                    <td className="px-4 py-1 whitespace-nowrap">{r.personalInfo?.firstName} {r.personalInfo?.lastName}</td>
                    <td className="px-4 py-1 whitespace-nowrap">{r.category}</td>
                    <td className="px-4 py-1"><PaymentBadge status={payStatus}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RegistrationsPage; 