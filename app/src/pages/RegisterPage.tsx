import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Mail, KeyRound, User } from 'lucide-react';
import { useTheme } from '@/ThemeContext';
import InputField from '@/components/ui/InputField';
import Button from '@/components/ui/Button';

interface RegisterForm { name: string; email: string; password: string }

export default function RegisterPage() {
  const { register: registerUser, loading, error } = useAuthStore();
  const form = useForm<RegisterForm>();
  const navigate = useNavigate();
  const { theme } = useTheme();

  return <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: theme.bgPrimary }}>
    <div style={{ width: 420, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28, display: 'grid', gap: 14 }}>
      <h1 style={{ color: theme.textPrimary, margin: 0 }}>Criar conta</h1>
      <form onSubmit={form.handleSubmit(async (d) => { await registerUser(d.name, d.email, d.password); navigate('/login'); })} style={{ display: 'grid', gap: 14 }}>
        <InputField label='Nome' icon={<User size={16} />} {...form.register('name', { required: true })} />
        <InputField label='Email' icon={<Mail size={16} />} {...form.register('email', { required: true })} />
        <InputField type='password' label='Senha' icon={<KeyRound size={16} />} {...form.register('password', { required: true, minLength: 6 })} />
        <Button type='submit' disabled={loading}>Criar conta</Button>
      </form>
      {error ? <span style={{ color: theme.danger }}>{error}</span> : null}
      <Link to='/login' style={{ color: theme.accent }}>Fazer login</Link>
    </div>
  </div>;
}
