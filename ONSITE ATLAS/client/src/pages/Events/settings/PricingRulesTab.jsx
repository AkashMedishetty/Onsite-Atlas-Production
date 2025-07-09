import React, { useEffect, useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Input, Button, Select, Switch } from '../../../components/common';
import { useParams } from 'react-router-dom';
import pricingService from '../../../services/pricingService';
import { Dialog } from '@headlessui/react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import PricingMatrix from './PricingMatrix';

const emptyRule = {
  name: '',
  tier: '',
  audience: '',
  category: '',
  priceCents: 0,
  startDate: '',
  endDate: '',
  active: true,
  priority: 0,
  exclusive: false,
};

const PricingRulesTab = () => {
  const { id: eventId } = useParams();
  const [rules, setRules] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyRule);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tierInput, setTierInput] = useState('');
  const [audienceInput, setAudienceInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [basePrice, setBasePrice] = useState(0);
  const [surchargePercent, setSurchargePercent] = useState(0);
  const [csvOpen,setCsvOpen]=useState(false);
  const [csvText,setCsvText]=useState('');

  const load = async () => {
    console.log('[PricingRulesTab] Loading pricing rules for eventId:', eventId);
    try {
      const res = await pricingService.list(eventId);
      const extractedRules = res.data || res.rules || res;
      console.log('[PricingRulesTab] Loaded rules count:', extractedRules?.length || 0);
      setRules(extractedRules || []);
    } catch (error) {
      console.error('Error loading pricing rules:', error);
      setRules([]);
    }
  };

  useEffect(() => { if (eventId) load(); }, [eventId]);

  const save = async () => {
    if (editing) {
      await pricingService.update(eventId, editing._id, form);
    } else {
      await pricingService.create(eventId, form);
    }
    setForm(emptyRule);
    setEditing(null);
    load();
  };

  const startEdit = (r) => { setEditing(r); setForm({ ...r, startDate: r.startDate?.slice(0,10)||'', endDate: r.endDate?.slice(0,10)||'' }); };

  const remove = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    await pricingService.remove(eventId, id);
    load();
  };

  const handle = (field, val) => setForm({ ...form, [field]: val });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Pricing Rules</h2>
      <div className="my-8">
        <PricingMatrix eventId={eventId} rules={rules} onReload={load} />
      </div>
    </div>
  );
};

export default PricingRulesTab; 