import React, { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import paymentService from '../../services/paymentService';

const PaymentDetailDrawer = ({ eventId, paymentId, open, onClose }) => {
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    if (open && paymentId) {
      paymentService.getPaymentDetail(eventId, paymentId).then(res => {
        setPayment(res.data || res.payment || res);
      });
    }
  }, [open, paymentId, eventId]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 z-40 flex">
      <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
      <div className="relative ml-auto bg-white w-96 max-w-full h-full shadow-xl p-6 space-y-4 overflow-y-auto">
        <h3 className="text-lg font-semibold">Payment Detail</h3>
        {payment ? (
          <div className="space-y-2 text-sm">
            <div><strong>ID:</strong> {payment._id}</div>
            <div><strong>Status:</strong> {payment.status}</div>
            <div><strong>Provider:</strong> {payment.provider}</div>
            <div><strong>Amount:</strong> ₹ {(payment.amountCents/100).toFixed(2)}</div>
            <div><strong>Method:</strong> {payment.method}</div>
            <div><strong>Captured At:</strong> {payment.capturedAt ? new Date(payment.capturedAt).toLocaleString() : '—'}</div>
            <div><strong>Registration:</strong> {payment.registration?.registrationId || '—'} </div>
            {payment.invoiceUrl && (
              <button onClick={async()=>{
                try{
                  const blob = await paymentService.getInvoice(eventId, payment._id);
                  const { saveAs } = await import('file-saver');
                  saveAs(blob, `invoice_${payment._id}.pdf`);
                }catch(err){ console.error('Invoice download failed',err); }
              }} className="mt-3 px-3 py-1 bg-indigo-600 text-white rounded">Download Invoice</button>
            )}
            {payment.provider==='offline' && payment.status==='initiated' && (
              <button onClick={async()=>{
                try{
                  await paymentService.markPaymentPaid(eventId, payment._id);
                  alert('Payment marked as paid');
                  onClose();
                }catch(err){ alert('Failed'); console.error(err);} }
              } className="mt-2 px-3 py-1 bg-green-600 text-white rounded">Mark Paid</button>
            )}
            <div className="bg-gray-100 rounded p-2 text-xs break-all"><pre>{JSON.stringify(payment.meta,null,2)}</pre></div>
          </div>
        ) : (<div>Loading…</div>)}
      </div>
    </Dialog>
  );
};
export default PaymentDetailDrawer; 