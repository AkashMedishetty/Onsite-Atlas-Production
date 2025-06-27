import React, { useState } from 'react';
import { Input, Button, Alert, Spinner } from '../common';
import authorAuthService from '../../services/authorAuthService';
import toast from 'react-hot-toast';

const AuthorAuthWizard = ({ eventId, onSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let resp;
      if (mode === 'signup') {
        const { name, email, mobile, password } = form;
        resp = await authorAuthService.signup(eventId, name, email, mobile, password);
      } else {
        const { email, password } = form;
        resp = await authorAuthService.login(email, password);
      }
      if (resp.success) {
        toast.success(mode === 'signup' ? 'Account created!' : 'Logged in');
        if (onSuccess) onSuccess(resp.data);
      } else {
        setError(resp.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex mb-4 space-x-2 justify-center">
        <Button variant={mode === 'login' ? 'primary' : 'outline'} onClick={() => setMode('login')}>Login</Button>
        <Button variant={mode === 'signup' ? 'primary' : 'outline'} onClick={() => setMode('signup')}>Sign&nbsp;Up</Button>
      </div>
      {error && <Alert type="error" message={error} onClose={() => setError(null)} className="mb-4" />}
      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <Input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required />
        )}
        <Input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        {mode === 'signup' && (
          <Input name="mobile" placeholder="Mobile Number" value={form.mobile} onChange={handleChange} required />
        )}
        <Input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required />
        <Button type="submit" className="w-full" disabled={loading}>{loading ? <Spinner size="sm" /> : mode === 'signup' ? 'Create Account' : 'Login'}</Button>
      </form>
    </div>
  );
};

export default AuthorAuthWizard; 