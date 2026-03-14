import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '@/services/api';
import { MessageSquare, Mail, User, KeyRound, Loader2 } from 'lucide-react';
import './RegisterPage.css';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>();
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
    <div className="register-page">
      <div className="register-page__bg">
        <div className="register-page__glow register-page__glow--top" />
        <div className="register-page__glow register-page__glow--bottom" />
      </div>

      <div className="register-page__wrapper">
        <div className="register-page__brand">
          <div className="register-page__brand-icon">
            <MessageSquare size={22} color="#fff" />
          </div>
          <span className="register-page__brand-name">Dear Bot</span>
        </div>

        <div className="register-page__card">
          <h1 className="register-page__heading">Criar conta</h1>
          <p className="register-page__subheading">Preencha os dados para se cadastrar</p>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 20 }}>
              {error}
            </div>
          )}

          <form className="register-page__form" onSubmit={handleSubmit(onSubmit)}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label">Nome</label>
              <div className="input-wrapper">
                <span className="input-icon"><User size={17} /></span>
                <input
                  {...register('name', { required: 'Nome obrigatório' })}
                  type="text"
                  placeholder="Seu nome"
                  className="form-input with-icon"
                />
              </div>
              {errors.name && <span className="form-error">{errors.name.message}</span>}
            </div>

            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label">Email</label>
              <div className="input-wrapper">
                <span className="input-icon"><Mail size={17} /></span>
                <input
                  {...register('email', {
                    required: 'Email obrigatório',
                    pattern: { value: /^\S+@\S+$/, message: 'Email inválido' },
                  })}
                  type="email"
                  placeholder="seu@email.com"
                  className="form-input with-icon"
                />
              </div>
              {errors.email && <span className="form-error">{errors.email.message}</span>}
            </div>

            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label">Senha</label>
              <div className="input-wrapper">
                <span className="input-icon"><KeyRound size={17} /></span>
                <input
                  {...register('password', {
                    required: 'Senha obrigatória',
                    minLength: { value: 6, message: 'Mínimo 6 caracteres' },
                  })}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="form-input with-icon"
                />
              </div>
              {errors.password && <span className="form-error">{errors.password.message}</span>}
            </div>

            <button type="submit" disabled={loading} className="register-page__submit">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
        </div>

        <p className="register-page__footer">
          Já tem uma conta?{' '}
          <Link to="/login" className="register-page__footer-link">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
