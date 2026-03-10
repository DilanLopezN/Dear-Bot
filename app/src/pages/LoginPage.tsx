import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';
import { Mail, KeyRound } from 'lucide-react';
import { useTheme } from '@/ThemeContext';
import InputField from '@/components/ui/InputField';
import Button from '@/components/ui/Button';

interface EmailForm { email: string }
interface TokenForm { token: string }

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'token'>('email');
  const [email, setEmail] = useState('');
  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();
  const emailForm = useForm<EmailForm>();
  const tokenForm = useForm<TokenForm>();
  const { theme } = useTheme();

  return <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: theme.bgPrimary }}>
    <div style={{ width: 420, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28, display: 'grid', gap: 14 }}>
      <h1 style={{ color: theme.textPrimary, margin: 0 }}>Entrar</h1>
      {step === 'email' ? (
        <form onSubmit={emailForm.handleSubmit(async (d) => { await api.requestToken(d.email); setEmail(d.email); setStep('token'); })} style={{ display: 'grid', gap: 14 }}>
          <InputField label='Email' icon={<Mail size={16} />} {...emailForm.register('email', { required: true })} />
          <Button type='submit'>Enviar token</Button>
        </form>
      ) : (
        <form onSubmit={tokenForm.handleSubmit(async (d) => { await login(email, d.token); navigate('/'); })} style={{ display: 'grid', gap: 14 }}>
          <InputField label='Token' icon={<KeyRound size={16} />} {...tokenForm.register('token', { required: true })} />
          <Button type='submit' disabled={loading}>Entrar</Button>
        </form>
      )}
      {error ? <span style={{ color: theme.danger }}>{error}</span> : null}
      <Link to='/register' style={{ color: theme.accent }}>Criar conta</Link>
    </div>
  </div>;
}
