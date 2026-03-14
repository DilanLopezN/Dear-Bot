import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';
import { MessageSquare, Mail, KeyRound, Loader2, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import './LoginPage.css';

interface EmailForm { email: string }
interface TokenForm { token: string }
interface PasswordForm { email: string; password: string }

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
    try { await login(email, data.token); navigate('/'); } catch {}
  };

  const onLoginPassword = async (data: PasswordForm) => {
    try { await loginWithPassword(data.email, data.password); navigate('/'); } catch {}
  };

  return (
    <div className="login-page">
      <div className="login-page__bg">
        <div className="login-page__glow login-page__glow--top" />
        <div className="login-page__glow login-page__glow--bottom" />
      </div>

      <div className="login-page__wrapper">
        <div className="login-page__brand">
          <div className="login-page__brand-icon">
            <MessageSquare size={22} color="#fff" />
          </div>
          <span className="login-page__brand-name">Dear Bot</span>
        </div>

        <div className="login-page__card">
          {justRegistered && loginMethod === 'password' && step === 'email' && (
            <div className="alert alert-success" style={{ marginBottom: 24 }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              Conta criada! Use seu email e senha para entrar.
            </div>
          )}

          {step === 'email' && (
            <div className="login-page__tabs">
              <button
                className={`login-page__tab${loginMethod === 'password' ? ' login-page__tab--active' : ''}`}
                onClick={() => setLoginMethod('password')}
              >
                Senha
              </button>
              <button
                className={`login-page__tab${loginMethod === 'token' ? ' login-page__tab--active' : ''}`}
                onClick={() => setLoginMethod('token')}
              >
                Token por Email
              </button>
            </div>
          )}

          {/* PASSWORD LOGIN */}
          {loginMethod === 'password' && (
            <>
              <h1 className="login-page__heading">Entrar na plataforma</h1>
              <p className="login-page__subheading">Use seu email e senha para acessar</p>

              {error && (
                <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                  {error}
                </div>
              )}

              <form className="login-page__form" onSubmit={passwordForm.handleSubmit(onLoginPassword)}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Mail size={17} /></span>
                    <input
                      {...passwordForm.register('email', {
                        required: 'Email obrigatório',
                        pattern: { value: /^\S+@\S+$/, message: 'Email inválido' },
                      })}
                      type="email"
                      placeholder="seu@email.com"
                      className="form-input with-icon"
                    />
                  </div>
                  {passwordForm.formState.errors.email && (
                    <span className="form-error">{passwordForm.formState.errors.email.message}</span>
                  )}
                </div>

                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Senha</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Lock size={17} /></span>
                    <input
                      {...passwordForm.register('password', {
                        required: 'Senha obrigatória',
                        minLength: { value: 6, message: 'Mínimo 6 caracteres' },
                      })}
                      type="password"
                      placeholder="Sua senha"
                      className="form-input with-icon"
                    />
                  </div>
                  {passwordForm.formState.errors.password && (
                    <span className="form-error">{passwordForm.formState.errors.password.message}</span>
                  )}
                </div>

                <button type="submit" disabled={loading} className="login-page__submit">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          )}

          {/* TOKEN LOGIN — Step 1: Email */}
          {loginMethod === 'token' && step === 'email' && (
            <>
              <h1 className="login-page__heading">Entrar na plataforma</h1>
              <p className="login-page__subheading">Informe seu email para receber o código de acesso</p>

              {tokenError && (
                <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                  {tokenError}
                </div>
              )}

              <form className="login-page__form" onSubmit={emailForm.handleSubmit(onRequestToken)}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Mail size={17} /></span>
                    <input
                      {...emailForm.register('email', {
                        required: 'Email obrigatório',
                        pattern: { value: /^\S+@\S+$/, message: 'Email inválido' },
                      })}
                      type="email"
                      placeholder="seu@email.com"
                      className="form-input with-icon"
                    />
                  </div>
                  {emailForm.formState.errors.email && (
                    <span className="form-error">{emailForm.formState.errors.email.message}</span>
                  )}
                </div>

                <button type="submit" disabled={sendingToken} className="login-page__submit">
                  {sendingToken && <Loader2 size={16} className="animate-spin" />}
                  {sendingToken ? 'Enviando...' : 'Enviar código de acesso'}
                </button>
              </form>
            </>
          )}

          {/* TOKEN LOGIN — Step 2: Verify */}
          {loginMethod === 'token' && step === 'token' && (
            <>
              <button className="login-page__back" onClick={() => setStep('email')}>
                <ArrowLeft size={15} /> Voltar
              </button>

              <h1 className="login-page__heading">Verificar código</h1>
              <p className="login-page__subheading">
                Enviamos um código de 6 dígitos para{' '}
                <span className="login-page__email-highlight">{email}</span>
              </p>

              {error && (
                <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                  {error}
                </div>
              )}

              <form className="login-page__form" onSubmit={tokenForm.handleSubmit(onLoginToken)}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Código de acesso</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><KeyRound size={17} /></span>
                    <input
                      {...tokenForm.register('token', {
                        required: 'Código obrigatório',
                        minLength: { value: 6, message: 'Código de 6 dígitos' },
                      })}
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="form-input with-icon login-page__token-input"
                    />
                  </div>
                  {tokenForm.formState.errors.token && (
                    <span className="form-error">{tokenForm.formState.errors.token.message}</span>
                  )}
                </div>

                <button type="submit" disabled={loading} className="login-page__submit">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="login-page__footer">
          Não tem uma conta?{' '}
          <Link to="/register" className="login-page__footer-link">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
