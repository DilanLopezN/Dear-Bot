import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';
import { MessageSquare, Mail, KeyRound, Loader2, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';

interface EmailForm {
  email: string;
}

interface TokenForm {
  token: string;
}

interface PasswordForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [loginMethod, setLoginMethod] = useState<'password' | 'token'>('password');
  const [step, setStep] = useState<'email' | 'token'>('email');
  const [email, setEmail] = useState('');
  const [sendingToken, setSendingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const { login, loginWithPassword, loading, error } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = (location.state as any)?.registered;

  const emailForm = useForm<EmailForm>();
  const tokenForm = useForm<TokenForm>();
  const passwordForm = useForm<PasswordForm>();

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

  const onLoginToken = async (data: TokenForm) => {
    try {
      await login(email, data.token);
      navigate('/');
    } catch {}
  };

  const onLoginPassword = async (data: PasswordForm) => {
    try {
      await loginWithPassword(data.email, data.password);
      navigate('/');
    } catch {}
  };

  const inputClass = "w-full pl-12 pr-4 py-3.5 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all";

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
          {justRegistered && loginMethod === 'password' && step === 'email' && (
            <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              Conta criada! Use seu email e senha para entrar.
            </div>
          )}

          {/* Method toggle tabs */}
          {step === 'email' && (
            <div className="flex mb-8 rounded-xl bg-[var(--color-bg-tertiary)] p-1">
              <button
                onClick={() => setLoginMethod('password')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  loginMethod === 'password'
                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Senha
              </button>
              <button
                onClick={() => setLoginMethod('token')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  loginMethod === 'token'
                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Token por Email
              </button>
            </div>
          )}

          {/* PASSWORD LOGIN */}
          {loginMethod === 'password' && (
            <>
              <h1
                className="text-2xl font-semibold mb-2 text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Entrar na plataforma
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mb-8">
                Use seu email e senha para acessar
              </p>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={passwordForm.handleSubmit(onLoginPassword)} className="flex flex-col gap-5">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2.5 block">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                      <Mail className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />
                    </div>
                    <input
                      {...passwordForm.register('email', {
                        required: 'Email obrigatório',
                        pattern: { value: /^\S+@\S+$/, message: 'Email inválido' },
                      })}
                      type="email"
                      placeholder="seu@email.com"
                      className={inputClass}
                    />
                  </div>
                  {passwordForm.formState.errors.email && (
                    <span className="text-xs text-red-400 mt-2 block">
                      {passwordForm.formState.errors.email.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2.5 block">
                    Senha
                  </label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                      <Lock className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />
                    </div>
                    <input
                      {...passwordForm.register('password', {
                        required: 'Senha obrigatória',
                        minLength: { value: 6, message: 'Mínimo 6 caracteres' },
                      })}
                      type="password"
                      placeholder="Sua senha"
                      className={inputClass}
                    />
                  </div>
                  {passwordForm.formState.errors.password && (
                    <span className="text-xs text-red-400 mt-2 block">
                      {passwordForm.formState.errors.password.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-green-500/20"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          )}

          {/* TOKEN LOGIN - Step 1: Email */}
          {loginMethod === 'token' && step === 'email' && (
            <>
              <h1
                className="text-2xl font-semibold mb-2 text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Entrar na plataforma
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mb-8">
                Informe seu email para receber o código de acesso
              </p>

              {tokenError && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {tokenError}
                </div>
              )}

              <form onSubmit={emailForm.handleSubmit(onRequestToken)} className="flex flex-col gap-6">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2.5 block">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                      <Mail className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />
                    </div>
                    <input
                      {...emailForm.register('email', {
                        required: 'Email obrigatório',
                        pattern: { value: /^\S+@\S+$/, message: 'Email inválido' },
                      })}
                      type="email"
                      placeholder="seu@email.com"
                      className={inputClass}
                    />
                  </div>
                  {emailForm.formState.errors.email && (
                    <span className="text-xs text-red-400 mt-2 block">
                      {emailForm.formState.errors.email.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sendingToken}
                  className="w-full py-3.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-green-500/20"
                >
                  {sendingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {sendingToken ? 'Enviando...' : 'Enviar código de acesso'}
                </button>
              </form>
            </>
          )}

          {/* TOKEN LOGIN - Step 2: Token verification */}
          {loginMethod === 'token' && step === 'token' && (
            <>
              <button
                onClick={() => setStep('email')}
                className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>

              <h1
                className="text-2xl font-semibold mb-2 text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Verificar código
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mb-8">
                Enviamos um código de 6 dígitos para{' '}
                <span className="text-[var(--color-accent)] font-medium">{email}</span>
              </p>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={tokenForm.handleSubmit(onLoginToken)} className="flex flex-col gap-6">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2.5 block">
                    Código de acesso
                  </label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                      <KeyRound className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />
                    </div>
                    <input
                      {...tokenForm.register('token', {
                        required: 'Código obrigatório',
                        minLength: { value: 6, message: 'Código de 6 dígitos' },
                      })}
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className={inputClass + ' tracking-[6px] text-center font-mono text-lg'}
                    />
                  </div>
                  {tokenForm.formState.errors.token && (
                    <span className="text-xs text-red-400 mt-2 block">
                      {tokenForm.formState.errors.token.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-green-500/20"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-8">
          Não tem uma conta?{' '}
          <Link to="/register" className="text-[var(--color-accent)] hover:underline font-medium">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
