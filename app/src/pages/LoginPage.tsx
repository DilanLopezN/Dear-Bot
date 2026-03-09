import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { MessageSquare, Mail, KeyRound, Loader2 } from 'lucide-react';

interface LoginForm {
  email: string;
  token: string;
}

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.token);
      navigate('/');
    } catch {}
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-bg-primary)] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--color-accent)] opacity-[0.04] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600 opacity-[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-11 h-11 rounded-xl bg-[var(--color-accent)] flex items-center justify-center shadow-lg shadow-[var(--color-accent-glow)]">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            Chatbot SaaS
          </span>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-8 shadow-2xl shadow-black/20">
          <h1 className="text-xl font-semibold mb-1 text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            Entrar na plataforma
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            Use o email e token recebido por email
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  {...register('email', { required: 'Email obrigatório', pattern: { value: /^\S+@\S+$/, message: 'Email inválido' } })}
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
                />
              </div>
              {errors.email && <span className="text-xs text-red-400 mt-1">{errors.email.message}</span>}
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                Token de acesso
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  {...register('token', { required: 'Token obrigatório', minLength: { value: 6, message: 'Token mínimo 6 caracteres' } })}
                  type="password"
                  placeholder="Token recebido por email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
                />
              </div>
              {errors.token && <span className="text-xs text-red-400 mt-1">{errors.token.message}</span>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-[var(--color-accent-glow)]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          Não recebeu o token? Verifique sua caixa de spam.
        </p>
      </div>
    </div>
  );
}
