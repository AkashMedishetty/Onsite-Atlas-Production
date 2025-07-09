import React, { useEffect, useState } from 'react';
import { Card, Switch, Select, Input, Button, Spinner } from '../../../components/common';
import { useParams } from 'react-router-dom';
import paymentConfigService from '../../../services/paymentConfigService';
import eventService from '../../../services/eventService';

const providerFields = {
  razorpay: [
    { id: 'keyId', label: 'Key ID' },
    { id: 'keySecret', label: 'Key Secret', type: 'password' },
    { id: 'webhookSecret', label: 'Webhook Secret', type: 'password' },
  ],
  instamojo: [
    { id: 'apiKey', label: 'API Key' },
    { id: 'authToken', label: 'Auth Token', type: 'password' },
    { id: 'hmacSalt', label: 'HMAC Salt', type: 'password' },
  ],
  stripe: [
    { id: 'secretKey', label: 'Secret Key', type: 'password' },
    { id: 'webhookSecret', label: 'Webhook Secret', type: 'password' },
  ],
  phonepe: [
    { id: 'merchantId', label: 'Merchant ID' },
    { id: 'saltKey', label: 'Salt Key', type: 'password' },
    { id: 'saltIndex', label: 'Salt Index' },
  ],
  cashfree: [
    { id: 'appId', label: 'App ID' },
    { id: 'secretKey', label: 'Secret Key', type: 'password' },
  ],
  payu: [
    { id: 'merchantKey', label: 'Merchant Key' },
    { id: 'merchantSalt', label: 'Merchant Salt', type: 'password' },
    { id: 'authHeader', label: 'Auth Header (Base64 key:salt)' },
  ],
  paytm: [
    { id: 'mid', label: 'MID' },
    { id: 'key', label: 'Secret Key', type: 'password' },
  ],
};

const providerOptions = Object.keys(providerFields).map(p=>({ value:p, label:p.toUpperCase() }));

const PaymentTab = () => {
  const { id: eventId } = useParams();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [dirty,setDirty]=useState(false);
  const [event, setEvent] = useState(null);

  // load config
  useEffect(()=>{
    if(!eventId) return;
    (async()=>{
      const res = await paymentConfigService.get(eventId);
      setConfig(res.data || res.paymentConfig || res);
      // fetch categories for category-wise toggle
      const catRes = await eventService.getEventCategories(eventId);
      setCategories(catRes.data || catRes.categories || []);
      const eventRes = await eventService.getEventById(eventId);
      setEvent(eventRes.data || eventRes.event || eventRes);
    })();
  },[eventId]);

  if(!config) return <div className="p-4"><Spinner size="sm"/> Loading payment config…</div>;

  const updateField = (path,val)=>{
    setConfig(prev=>{
      const next={...prev};
      // simple path handling provider/credentials/extra
      if(path==="provider"||path==="mode") next[path]=val;
      else if(path.startsWith('cred.')){
        next.credentials={...(next.credentials||{})};
        next.credentials[path.slice(5)]=val;
      } else if(path.startsWith('extra.')){
        next.extra={...(next.extra||{})};
        next.extra[path.slice(6)]=val;
      }
      setDirty(true);
      return next;
    });
  };

  const save = async()=>{
    if(!dirty) return;
    setSaving(true);
    try {
      // Save payment config
      await paymentConfigService.update(eventId, config);
      
      // Save event changes if event has been modified (e.g., accompanying person settings)
      if (event && event.accompanyingPersonSettings) {
        await eventService.updateEvent(eventId, {
          accompanyingPersonSettings: event.accompanyingPersonSettings
        });
      }
      
      setSaving(false); 
      setDirty(false);
      alert('Saved');
    } catch (error) {
      setSaving(false);
      console.error('Save error:', error);
      alert('Error saving: ' + (error.message || 'Unknown error'));
    }
  };

  const fields = providerFields[config.provider] || [];

  const offlineOptions=[{value:'cash',label:'Cash'},{value:'draft',label:'Demand Draft'},{value:'bank-transfer',label:'Bank Transfer'}];

  const extraBooleanFields=[
    {id:'paymentsEnabled',label:'Payments Enabled'},
    {id:'paymentRequired',label:'Payment Required'},
    {id:'autoInvoice',label:'Auto-generate Invoice'},
  ];
  const extraNumberFields=[
    {id:'seatHoldTtlMinutes',label:'Seat-hold TTL (minutes)'},
    {id:'paymentWindowMinutes',label:'Payment-window (minutes)'},
    {id:'minimumPercentage',label:'Minimum % (for partial payments)'},
    {id:'gstPercentage',label:'GST %'},
    {id:'vatPercentage',label:'VAT %'},
    {id:'convenienceFeePercentage',label:'Convenience Fee %'},
    {id:'fixedFee',label:'Fixed Fee (₹)'},
    {id:'retryLimit',label:'Webhook Retry Limit'},
  ];
  const extraTextFields=[
    {id:'currency',label:'Currency (ISO)'},
    {id:'callbackUrl',label:'Callback URL'},
    {id:'webhookUrl',label:'Webhook URL'},
    {id:'orderPrefix',label:'Order Prefix'},
    {id:'themeColor',label:'Theme Color'},
    {id:'statementDescriptor',label:'Statement Descriptor'},
  ];

  return (
    <div className="space-y-6">
      <Card title="Gateway Settings" className="bg-white">
        <div className="space-y-4 p-4">
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <Select value={config.provider} options={providerOptions} onChange={val=>updateField('provider', val)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mode</label>
            <Select value={config.mode} options={[{value:'test',label:'Test'},{value:'live',label:'Live'}]} onChange={val=>updateField('mode', val)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(f=>(
              <div key={f.id}>
                <label className="block text-sm font-medium mb-1">{f.label}</label>
                <Input type={f.type||'text'} value={(config.credentials||{})[f.id]||''} onChange={e=>updateField(`cred.${f.id}`,e.target.value)} />
              </div>
            ))}
          </div>
          <div className="text-right pt-2">
            <Button onClick={save} disabled={saving || !dirty}>{saving?'Saving…':'Save'}</Button>
          </div>
        </div>
      </Card>

      <Card title="Global Toggles" className="bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {extraBooleanFields.map(f=> (
            <Switch key={f.id} label={f.label} checked={!!(config.extra||{})[f.id]} onChange={v=>updateField(`extra.${f.id}`,v)} />
          ))}
        </div>
      </Card>

      <Card title="Behaviour & Flow" className="bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {extraNumberFields.slice(0,2).map(f=> (
            <Input key={f.id} label={f.label} type="number" value={(config.extra||{})[f.id]||''} onChange={e=>updateField(`extra.${f.id}`,e.target.value?parseInt(e.target.value):'')} />
          ))}
          {extraTextFields.filter(f=>['currency','callbackUrl','webhookUrl','orderPrefix'].includes(f.id)).map(f=> (
            <Input key={f.id} label={f.label} value={(config.extra||{})[f.id]||''} onChange={e=>updateField(`extra.${f.id}`,e.target.value)} />
          ))}
          <Select multiple label="Offline Methods Allowed" options={offlineOptions} value={(config.extra?.offlineMethodsAllowed)||[]} onChange={val=>updateField('extra.offlineMethodsAllowed',val)} />
          {categories.length>0 && (
            <Select
              multiple
              label="Categories REQUIRING Payment"
              options={categories.map(c=>({value:c._id||c.id,label:c.name}))}
              value={config.extra?.paymentRequiredCategories||[]}
              onChange={val=>updateField('extra.paymentRequiredCategories',val)}
            />
          )}
        </div>
      </Card>

      <Card title="Partial / Deposits" className="bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <Switch label="Allow Partial Payments" checked={!!(config.extra||{}).partialPaymentAllowed} onChange={v=>updateField('extra.partialPaymentAllowed',v)} />
          <Input label="Minimum %" type="number" value={(config.extra||{}).minimumPercentage||''} onChange={e=>updateField('extra.minimumPercentage',e.target.value?parseFloat(e.target.value):'')} />
        </div>
      </Card>

      <Card title="Reporting & Finance" className="bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {extraNumberFields.filter(f=>['gstPercentage','vatPercentage','convenienceFeePercentage','fixedFee'].includes(f.id)).map(f=> (
            <Input key={f.id} label={f.label} type="number" value={(config.extra||{})[f.id]||''} onChange={e=>updateField(`extra.${f.id}`,e.target.value?parseFloat(e.target.value):'')} />
          ))}
          <Switch label="Auto-generate Invoice" checked={!!(config.extra||{}).autoInvoice} onChange={v=>updateField('extra.autoInvoice',v)} />
        </div>
      </Card>

      <Card title="Advanced" className="bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {extraTextFields.filter(f=>['themeColor','statementDescriptor'].includes(f.id)).map(f=> (
            <Input key={f.id} label={f.label} value={(config.extra||{})[f.id]||''} onChange={e=>updateField(`extra.${f.id}`,e.target.value)} />
          ))}
          <Input label="Retry Limit" type="number" value={(config.extra||{}).retryLimit||''} onChange={e=>updateField('extra.retryLimit',e.target.value?parseInt(e.target.value):'')} />
          <Input label="Invoice Header" value={(config.extra||{}).invoiceHeader||''} onChange={e=>updateField('extra.invoiceHeader', e.target.value)} />
          <Input label="Invoice Footer" value={(config.extra||{}).invoiceFooter||''} onChange={e=>updateField('extra.invoiceFooter', e.target.value)} />
          <Input label="Invoice Email Subject" value={(config.extra||{}).invoiceEmailSubject||''} onChange={e=>updateField('extra.invoiceEmailSubject', e.target.value)} />
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Invoice Email Body (HTML)</label>
            <textarea className="w-full border rounded p-2 h-32 text-sm font-mono" value={(config.extra||{}).invoiceEmailBody||''} onChange={e=>updateField('extra.invoiceEmailBody', e.target.value)} />
          </div>
        </div>
      </Card>

      <Card title="Accompanying Person Pricing">
        <div className="space-y-4">
          <Input
            type="number"
            label="Accompanying Person Fee (in your event currency, per person)"
            value={event?.accompanyingPersonSettings?.feeCents ? event.accompanyingPersonSettings.feeCents / 100 : 0}
            min={0}
            onChange={e => {
              const value = Math.round((parseFloat(e.target.value) || 0) * 100);
              setEvent({
                ...event,
                accompanyingPersonSettings: {
                  ...event.accompanyingPersonSettings,
                  feeCents: value
                }
              });
              setDirty(true);
            }}
            step="0.01"
            helperText="This fee will be charged for each accompanying person added to a registration."
          />
        </div>
      </Card>

      <div className="text-right py-4">
        <Button onClick={save} disabled={saving || !dirty}>{saving?'Saving…':'Save Changes'}</Button>
      </div>
    </div>
  );
};

export default PaymentTab;