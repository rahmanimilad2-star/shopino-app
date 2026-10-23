import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Shared IconButton component enforcing strict 40x40px dimensions,
 * centered 20x20px icon wrapper, and zero layout shift for badges.
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  badgeCount?: number;
  active?: boolean;
  variant?: 'default' | 'ghost' | 'danger';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  badgeCount,
  active = false,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variantClasses =
    variant === 'danger'
      ? 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400'
      : variant === 'ghost'
      ? 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      : active
      ? 'border-blue-600 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400'
      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

  return (
    <button
      type="button"
      className={`relative m-0 inline-flex h-10 w-10 min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border p-0 leading-none transition-colors focus:ring-2 focus:ring-blue-500/30 focus:outline-none disabled:opacity-50 ${variantClasses} ${className}`}
      {...props}
    >
      <span className="flex h-5 w-5 items-center justify-center">
        <Icon className="h-5 w-5 shrink-0" strokeWidth={1.85} />
      </span>
      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <span className="pointer-events-none absolute -top-1 -end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 font-mono text-[10px] font-bold leading-none text-white shadow-xs">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </button>
  );
};

/**
 * Shared Button component with strict height (40px default, 32px sm),
 * uniform padding, typography, border radius, and icon alignment.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'md' | 'sm';
  icon?: LucideIcon;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  children,
  className = '',
  type = 'button',
  ...props
}) => {
  const sizeClasses =
    size === 'sm'
      ? 'h-8 min-h-[32px] px-3 text-xs gap-1.5 rounded-lg'
      : 'h-10 min-h-[40px] px-4 text-xs gap-2 rounded-lg';

  const variantClasses = {
    primary:
      'border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500/30',
    secondary:
      'border border-transparent bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 focus:ring-2 focus:ring-slate-500/30',
    outline:
      'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 focus:ring-2 focus:ring-slate-500/20',
    danger:
      'border border-transparent bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500/30',
  }[variant];

  return (
    <button
      type={type}
      className={`m-0 inline-flex shrink-0 items-center justify-center font-semibold leading-none whitespace-nowrap transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50 ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {Icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
        </span>
      )}
      <span>{children}</span>
    </button>
  );
};

/**
 * Shared equal-height MetricCard component for Dashboard & Reports.
 */
export interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = 'blue',
  onClick,
}) => {
  const toneStyles = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }[tone];

  return (
    <div
      onClick={onClick}
      className={`flex h-full min-h-[124px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors dark:border-slate-800 dark:bg-slate-900 ${
        onClick ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="line-clamp-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneStyles}`}>
          <Icon className="h-5 w-5 shrink-0" strokeWidth={1.85} />
        </span>
      </div>
      <div className="mt-3 min-w-0">
        <div
          className="truncate font-mono text-lg font-bold tracking-tight text-slate-900 tabular-nums sm:text-xl dark:text-white"
          title={value}
        >
          {value}
        </div>
        {subtitle && (
          <div className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Shared StatusBadge with consistent height and typography.
 */
export const StatusBadge: React.FC<{
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}> = ({ label, tone = 'neutral' }) => {
  const styles = {
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
    warning:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
    danger:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
    info:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300',
    neutral:
      'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300',
  }[tone];

  return (
    <span
      className={`inline-flex h-6 items-center justify-center rounded-md border px-2.5 text-[11px] font-semibold leading-none whitespace-nowrap ${styles}`}
    >
      {label}
    </span>
  );
};
