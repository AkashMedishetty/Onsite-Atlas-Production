import React,{useEffect,useState} from 'react';
import { useParams } from 'react-router-dom';
import workshopService from '../../../services/workshopService';
import { Input, Button, Switch } from '../../../components/common';

const empty = { name:'', description:'', seatLimit:0, priceCents:0, active:true };

const WorkshopsTab=()=>{
  const { id:eventId } = useParams();
  const [list,setList]=useState([]);
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState(null);

  const load=async()=>{
    const res=await workshopService.list(eventId);
    setList(res.data||res.workshops||res);
  };
  useEffect(()=>{ if(eventId) load(); },[eventId]);

  const save=async()=>{
    if(editing){ await workshopService.update(eventId,editing._id,form);} else { await workshopService.create(eventId,form);} 
    setForm(empty); setEditing(null); load();
  };
  const handle=(field,val)=>setForm({...form,[field]:val});
  const startEdit=(w)=>{ setEditing(w); setForm({...w}); };
  const remove=async(id)=>{ if(!window.confirm('Delete workshop?')) return; await workshopService.remove(eventId,id); load(); };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Workshops</h2>
      <div className="bg-white p-4 shadow rounded-lg space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name" value={form.name} onChange={e=>handle('name',e.target.value)} />
          <Input label="Seat Limit" type="number" value={form.seatLimit} onChange={e=>handle('seatLimit',parseInt(e.target.value||0))} />
          <Input label="Price (₹)" type="number" value={form.priceCents/100} onChange={e=>handle('priceCents',parseFloat(e.target.value||0)*100)} />
          <Switch label="Active" checked={form.active} onChange={v=>handle('active',v)} />
          <div className="col-span-2">
            <Input label="Description" value={form.description} onChange={e=>handle('description',e.target.value)} />
          </div>
        </div>
        <Button onClick={save}>{editing?'Update':'Add'} Workshop</Button>
        {editing && <Button variant="secondary" onClick={()=>{setEditing(null); setForm(empty);}}>Cancel</Button>}
      </div>

      <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            {['Name','Price','Seats','Active','Actions'].map(h=>(<th key={h} className="px-4 py-2 text-xs font-medium text-gray-500">{h}</th>))}
          </tr>
        </thead>
        <tbody className="divide-y text-sm">
          {list.map(w=> (
            <tr key={w._id}>
              <td className="px-4 py-2">{w.name}</td>
              <td className="px-4 py-2">₹ {(w.priceCents/100).toFixed(2)}</td>
              <td className="px-4 py-2">{w.seatLimit||'—'}</td>
              <td className="px-4 py-2">{w.active?'Yes':'No'}</td>
              <td className="px-4 py-2 space-x-2">
                <button onClick={()=>startEdit(w)} className="text-blue-600 hover:underline">Edit</button>
                <button onClick={()=>remove(w._id)} className="text-red-600 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default WorkshopsTab; 