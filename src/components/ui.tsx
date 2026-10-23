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
      ? 'border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-800/80 dark:bg-[#111C30]/80 dark:text-[#94A3B8] dark:hover:border-red-500/40 dark:hover:bg-red-950/40 dark:hover:text-red-400'
      : variant === 'ghost'
      ? 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:bg-[#111C30] dark:hover:text-[#F1F5F9]'
      : active
      ? 'border-[#20D6C2]/60 bg-[#20D6C2]/12 text-[#0d9488] shadow-[0_0_16px_-4px_rgba(32,214,194,0.35)] dark:border-[#20D6C2]/50 dark:bg-[#20D6C2]/15 dark:text-[#20D6C2]'
      : 'border-slate-200/90 bg-white/90 text-slate-600 hover:border-[#20D6C2]/40 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700/50 dark:bg-[#111C30]/85 dark:text-[#94A3B8] dark:hover:border-[#20D6C2]/40 dark:hover:bg-[#16233B] dark:hover:text-[#F1F5F9]';

  return (
    <button
      type="button"
      className={`relative m-0 inline-flex h-10 w-10 min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border p-0 leading-none transition-all duration-150 focus:ring-2 focus:ring-[#20D6C2]/30 focus:outline-none disabled:opacity-50 ${variantClasses} ${className}`}
      {...props}
    >
      <span className="flex h-5 w-5 items-center justify-center">
        <Icon className="h-5 w-5 shrink-0" strokeWidth={1.85} />
      </span>
      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <span className="pointer-events-none absolute -top-1 -end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#20D6C2] px-1 font-mono text-[10px] font-extrabold leading-none text-[#041417] shadow-[0_0_10px_rgba(32,214,194,0.6)]">
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
      'border border-[#20D6C2]/80 bg-[#20D6C2] text-[#041417] font-bold shadow-[0_4px_18px_-4px_rgba(32,214,194,0.42)] hover:bg-[#31e2ce] hover:shadow-[0_6px_22px_-3px_rgba(32,214,194,0.58)] active:scale-[0.99] focus:ring-2 focus:ring-[#20D6C2]/40',
    secondary:
      'border border-[#7C83FF]/35 bg-[#7C83FF]/15 text-[#4f46e5] hover:bg-[#7C83FF]/25 dark:border-[#7C83FF]/40 dark:bg-[#7C83FF]/18 dark:text-[#c7d2fe] dark:hover:bg-[#7C83FF]/28 focus:ring-2 focus:ring-[#7C83FF]/30',
    outline:
      'border border-slate-200/90 bg-white/90 text-slate-700 hover:border-[#20D6C2]/45 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700/60 dark:bg-[#111C30]/80 dark:text-[#F1F5F9] dark:hover:border-[#20D6C2]/45 dark:hover:bg-[#16233B] focus:ring-2 focus:ring-[#20D6C2]/25',
    danger:
      'border border-red-500/40 bg-red-600 text-white shadow-[0_4px_14px_-4px_rgba(239,68,68,0.45)] hover:bg-red-500 focus:ring-2 focus:ring-red-500/35',
  }[variant];

  return (
    <button
      type={type}
      className={`m-0 inline-flex shrink-0 items-center justify-center font-semibold leading-none whitespace-nowrap transition-all duration-150 focus:outline-none disabled:pointer-events-none disabled:opacity-50 ${sizeClasses} ${variantClasses} ${className}`}
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
    blue: 'border border-[#20D6C2]/30 bg-[#20D6C2]/12 text-[#0d9488] dark:border-[#20D6C2]/30 dark:bg-[#20D6C2]/15 dark:text-[#20D6C2] shadow-[0_0_16px_-4px_rgba(32,214,194,0.28)]',
    emerald:
      'border border-emerald-500/25 bg-emerald-500/12 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-400 shadow-[0_0_16px_-4px_rgba(16,185,129,0.24)]',
    amber:
      'border border-amber-500/25 bg-amber-500/12 text-amber-600 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-400 shadow-[0_0_16px_-4px_rgba(245,158,11,0.24)]',
    rose: 'border border-rose-500/25 bg-rose-500/12 text-rose-600 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-400 shadow-[0_0_16px_-4px_rgba(244,63,94,0.24)]',
    slate:
      'border border-[#7C83FF]/25 bg-[#7C83FF]/12 text-[#4f46e5] dark:border-[#7C83FF]/30 dark:bg-[#7C83FF]/15 dark:text-[#7C83FF] shadow-[0_0_16px_-4px_rgba(124,131,255,0.25)]',
  }[tone];

  const topAccentBorder = {
    blue: 'before:bg-gradient-to-r before:from-[#20D6C2]/70 before:to-transparent',
    emerald: 'before:bg-gradient-to-r before:from-emerald-400/70 before:to-transparent',
    amber: 'before:bg-gradient-to-r before:from-amber-400/70 before:to-transparent',
    rose: 'before:bg-gradient-to-r before:from-rose-400/70 before:to-transparent',
    slate: 'before:bg-gradient-to-r before:from-[#7C83FF]/70 before:to-transparent',
  }[tone];

  return (
    <div
      onClick={onClick}
      className={`shopino-glass-card relative flex h-full min-h-[126px] flex-col justify-between overflow-hidden rounded-xl p-5 before:absolute before:top-0 before:inset-x-0 before:h-[2px] ${topAccentBorder} ${
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[#20D6C2]/45 dark:hover:border-[#20D6C2]/45'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="line-clamp-1 text-xs font-medium text-slate-500 dark:text-[#94A3B8]">
          {title}
        </span>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneStyles}`}>
          <Icon className="h-5 w-5 shrink-0" strokeWidth={1.85} />
        </span>
      </div>
      <div className="mt-3 min-w-0">
        <div
          className="truncate font-mono text-lg font-bold tracking-tight text-slate-900 tabular-nums sm:text-xl dark:text-[#F1F5F9]"
          title={value}
        >
          {value}
        </div>
        {subtitle && (
          <div className="mt-1 truncate text-[11px] text-slate-400 dark:text-[#94A3B8]/80">
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
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-300',
    warning:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-300',
    danger:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-300',
    info:
      'border-teal-200 bg-teal-50 text-teal-700 dark:border-[#20D6C2]/35 dark:bg-[#20D6C2]/12 dark:text-[#20D6C2]',
    neutral:
      'border-slate-200 bg-slate-100 text-slate-700 dark:border-[#7C83FF]/25 dark:bg-[#7C83FF]/10 dark:text-[#cbd5e1]',
  }[tone];

  return (
    <span
      className={`inline-flex h-6 items-center justify-center rounded-md border px-2.5 text-[11px] font-semibold leading-none whitespace-nowrap ${styles}`}
    >
      {label}
    </span>
  );
};
