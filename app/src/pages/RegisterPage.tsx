import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '@/services/api';
import { MessageSquare, Mail, User, KeyRound, Loader2 } from 'lucide-react';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError(null);
    try {
      await api.register(data.name, data.email, data.password);
      navigate('/login', { state: { registered: true } });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-bg-primary)] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--color-accent)] opacity-[0.05] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-800 opacity-[0.04] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[460px] px-6">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)] flex items-center justify-center shadow-lg shadow-green-500/20">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <span
            className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Dear Bot
          </span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-10 shadow-2xl shadow-black/40">
          <h1
            className="text-2xl font-semibold mb-2 text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Criar conta
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-8">
            Preencha os dados para se cadastrar
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2.5 block">
                Nome
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                  <User className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />
                </div>
                <input
                  {...register('name', { required: 'Nome obrigatório' })}
                  type="text"
                  placeholder="Seu nome"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
                />
              </div>
              {errors.name && (
                <span className="text-xs text-red-400 mt-2 block">{errors.name.message}</span>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2.5 block">
                Email
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                  <Mail className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />
                </div>
                <input
                  {...register('email', {
                    required: 'Email obrigatório',
                    pattern: { value: /^\S+@\S+$/, message: 'Email inválido' },
                  })}
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
                />
              </div>
              {errors.email && (
                <span className="text-xs text-red-400 mt-2 block">{errors.email.message}</span>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2.5 block">
                Senha
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                  <KeyRound className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />
                </div>
                <input
                  {...register('password', {
                    required: 'Senha obrigatória',
                    minLength: { value: 6, message: 'Mínimo 6 caracteres' },
                  })}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
                />
              </div>
              {errors.password && (
                <span className="text-xs text-red-400 mt-2 block">{errors.password.message}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-3.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-green-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-8">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-[var(--color-accent)] hover:underline font-medium">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
