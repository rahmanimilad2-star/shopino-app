import { Language } from '../i18n/translations.ts';

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(val: string | number): string {
  return String(val).replace(/\d/g, (d) => persianDigits[Number(d)]);
}

export function formatNumber(value: number | undefined | null, lang: Language): string {
  const num = Math.round(Number(value || 0));
  if (lang === 'fa') {
    const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
    return toPersianDigits(formatted);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
}

/**
 * Formats integer Toman amounts consistently without ever multiplying or dividing by 10.
 * Example (fa): "۱,۲۵۰,۰۰۰ تومان"
 * Example (en): "1,250,000 TOMAN"
 */
export function formatCurrency(
  value: number | undefined | null,
  lang: Language,
  _currency: string = 'TOMAN'
): string {
  const num = Math.round(Number(value || 0));
  const formattedNumber = formatNumber(Math.abs(num), lang);
  const sign = num < 0 ? '-' : '';
  if (lang === 'fa') {
    return `${sign}${formattedNumber} تومان`;
  }
  return `${sign}${formattedNumber} TOMAN`;
}

export function formatDate(
  isoDateStr: string | undefined | null,
  lang: Language,
  usePersianCalendar: boolean = true
): string {
  if (!isoDateStr) return '—';
  const normalized = isoDateStr.length === 10 ? `${isoDateStr}T12:00:00Z` : isoDateStr;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return isoDateStr;

  if (lang === 'fa' && usePersianCalendar) {
    try {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    } catch {
      return toPersianDigits(isoDateStr.slice(0, 10));
    }
  }

  return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent =
    '\uFEFF' + // UTF-8 BOM so Excel opens Persian characters cleanly
    [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
