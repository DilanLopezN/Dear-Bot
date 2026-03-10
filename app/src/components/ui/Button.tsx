import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTheme } from '@/ThemeContext';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
};

export default function Button({ variant = 'primary', icon, children, style, ...rest }: Props) {
  const { theme } = useTheme();

  const variantStyle = {
    primary: { background: theme.accent, color: '#fff', border: `1px solid ${theme.accent}` },
    secondary: { background: theme.bgCard, color: theme.textPrimary, border: `1px solid ${theme.border}` },
    danger: { background: `${theme.danger}16`, color: theme.danger, border: `1px solid ${theme.danger}44` },
  }[variant];

  return (
    <button
      {...rest}
      style={{
        height: 46,
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        padding: '0 16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        ...variantStyle,
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
