import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';
import { MessageSquare, Mail, KeyRound, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface EmailForm {
  email: string;
}

interface TokenForm {
  token: string;
}

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'token'>('email');
  const [email, setEmail] = useState('');
  const [sendingToken, setSendingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = (location.state as any)?.registered;

  const emailForm = useForm<EmailForm>();
  const tokenForm = useForm<TokenForm>();

  const onRequestToken = async (data: EmailForm) => {
    setSendingToken(true);
    setTokenError(null);
    try {
      await api.requestToken(data.email);
      setEmail(data.email);
      setStep('token');
    } catch (err: any) {
      setTokenError(err.response?.data?.message || 'Email não encontrado');
    } finally {
      setSendingToken(false);
    }
  };

  const onLogin = async (data: TokenForm) => {
    try {
      await login(email, data.token);
      navigate('/');
    } catch {}
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-bg-primary)] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--color-accent)] opacity-[0.05] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-800 opacity-[0.04] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-11 h-11 rounded-xl bg-[var(--color-accent)] flex items-center justify-center shadow-lg shadow-green-500/20">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span
            className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Dear Bot
          </span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-8 shadow-2xl shadow-black/40">
          {justRegistered && step === 'email' && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Conta criada! Insira seu email para receber o token de acesso.
            </div>
          )}

          {step === 'email' ? (
            <>
              <h1
                className="text-xl font-semibold mb-1 text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Entrar na plataforma
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                Informe seu email para receber o código de acesso
              </p>

              {tokenError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {tokenError}
                </div>
              )}

              <form onSubmit={emailForm.handleSubmit(onRequestToken)} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      {...emailForm.register('email', {
                        required: 'Email obrigatório',
                        pattern: { value: /^\S+@\S+$/, message: 'Email inválido' },
                      })}
                      type="email"
                      placeholder="seu@email.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
                    />
                  </div>
                  {emailForm.formState.errors.email && (
                    <span className="text-xs text-red-400 mt-1">
                      {emailForm.formState.errors.email.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sendingToken}
                  className="mt-2 w-full py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-green-500/20"
                >
                  {sendingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {sendingToken ? 'Enviando...' : 'Enviar código de acesso'}
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('email')}
                className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>

              <h1
                className="text-xl font-semibold mb-1 text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Verificar código
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                Enviamos um código de 6 dígitos para{' '}
                <span className="text-[var(--color-accent)]">{email}</span>
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={tokenForm.handleSubmit(onLogin)} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                    Código de acesso
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      {...tokenForm.register('token', {
                        required: 'Código obrigatório',
                        minLength: { value: 6, message: 'Código de 6 dígitos' },
                      })}
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all tracking-[6px] text-center font-mono text-lg"
                    />
                  </div>
                  {tokenForm.formState.errors.token && (
                    <span className="text-xs text-red-400 mt-1">
                      {tokenForm.formState.errors.token.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-green-500/20"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
          Não tem uma conta?{' '}
          <Link to="/register" className="text-[var(--color-accent)] hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
