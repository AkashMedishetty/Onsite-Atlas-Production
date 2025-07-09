import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import paymentService from '../../services/paymentService';
import toast from 'react-hot-toast';

const PayRedirect = () => {
  const { eventId, token } = useParams();

  useEffect(() => {
    const redeem = async () => {
      try {
        const res = await paymentService.redeemPaymentLink(eventId, token);
        const url = res?.data?.url || res.url;
        if (url) {
          window.location.href = url; // redirect to gateway page
        } else {
          toast.error('Failed to obtain checkout URL');
        }
      } catch (err) {
        console.error('Redeem error', err);
        toast.error(err.response?.data?.message || err.message || 'Redeem failed');
      }
    };
    redeem();
  }, [eventId, token]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-700">Redirecting to payment page…</p>
      </div>
    </div>
  );
};

export default PayRedirect; 