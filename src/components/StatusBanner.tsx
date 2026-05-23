interface StatusBannerProps {
  variant: 'info' | 'warn' | 'error';
  title: string;
  children?: React.ReactNode;
}

const STYLES = {
  info: 'border-brand-100 bg-brand-50 text-brand-900',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
} as const;

export function StatusBanner({ variant, title, children }: StatusBannerProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`rounded-md border p-4 ${STYLES[variant]}`}
    >
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}
