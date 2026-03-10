import type { InputHTMLAttributes, ReactNode } from 'react';
import { useTheme } from '@/ThemeContext';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: ReactNode;
  error?: string;
};

export default function InputField({ label, icon, error, style, ...rest }: Props) {
  const { theme } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label ? <label style={{ fontSize: 14, color: theme.textSecondary }}>{label}</label> : null}
      <div style={{ position: 'relative' }}>
        {icon ? <div style={{ position: 'absolute', left: 14, top: 12, color: theme.textSecondary }}>{icon}</div> : null}
        <input
          {...rest}
          style={{
            width: '100%',
            height: 46,
            borderRadius: 12,
            border: `1px solid ${error ? theme.danger : theme.border}`,
            background: theme.bgInput,
            color: theme.textPrimary,
            fontSize: 14,
            padding: icon ? '0 14px 0 42px' : '0 14px',
            ...style,
          }}
        />
      </div>
      {error ? <span style={{ color: theme.danger, fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}
