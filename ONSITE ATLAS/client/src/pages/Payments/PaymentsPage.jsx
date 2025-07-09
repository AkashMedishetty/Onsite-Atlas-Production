import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import paymentService from '../../services/paymentService';
import { saveAs } from 'file-saver';
import PaymentTable from '../../components/payments/PaymentTable';
import PaymentSummaryCards from '../../components/payments/PaymentSummaryCards';
import PaymentFilters from '../../components/payments/PaymentFilters';
import PaymentDetailDrawer from '../../components/payments/PaymentDetailDrawer';

const PaymentsPage = () => {
  const { id: eventId } = useParams(); // Expect route /events/:id/payments
  const [payments, setPayments] = useState([]);
  const [filters, setFilters] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  const fetchDataThrottled = React.useRef(null);

  const fetchData = async (currentFilters = filters) => {
    try {
      const res = await paymentService.getPayments(eventId, { limit: 100, ...currentFilters });
      const list = res?.data?.payments || res?.data?.data?.payments || res.payments || [];
      setPayments(list);
    } catch (err) {
      console.error('Failed to fetch payments', err);
    }
  };

  const applyFilters = (f) => {
    setFilters(f);
    fetchData(f);
  };

  useEffect(() => {
    if (!eventId) return;
    fetchData();

    const socket = io(import.meta.env.VITE_API_URL || '', {
      transports: ['websocket'],
      auth: { token: localStorage.getItem('token') },
    });
    socket.emit('join', eventId);
    socket.on('payments:update', () => {
      if (fetchDataThrottled.current) return;
      fetchDataThrottled.current = setTimeout(() => {
        fetchData();
        fetchDataThrottled.current = null;
      }, 200);
    });
    return () => socket.disconnect();
  }, [eventId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Payments</h1>
      <div className="mb-4 text-right">
        <button
          onClick={async () => {
            try {
              const blobRes = await paymentService.exportPaymentsCsv(eventId);
              const blob = new Blob([blobRes.data], { type: 'text/csv;charset=utf-8;' });
              saveAs(blob, `payments_${eventId}.csv`);
            } catch (err) {
              console.error('CSV export failed', err);
            }
          }}
          className="px-3 py-2 bg-indigo-600 text-white rounded shadow">
          Export CSV
        </button>
      </div>
      <PaymentFilters onApply={applyFilters} />
      <PaymentSummaryCards payments={payments} />
      <PaymentTable payments={payments} onSelect={(id)=>setSelectedId(id)} />
      <PaymentDetailDrawer eventId={eventId} paymentId={selectedId} open={!!selectedId} onClose={()=>setSelectedId(null)} />
    </div>
  );
};

export default PaymentsPage; 