import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Wallet,
  AlertCircle,
  TrendingUp,
  Download,
  Printer,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatNumber, formatDate, exportToCsv } from '../utils/format.ts';
import { MetricCard, Button } from '../components/ui.tsx';

export const ReportsPage: React.FC = () => {
  const { lang, t, settings, includeDemo, apiFetch, showToast } = useApp();

  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/reports?startDate=${startDate}&endDate=${endDate}&includeDemo=${includeDemo}`
      );
      setData(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, startDate, endDate, includeDemo, showToast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const s = data?.summary || {
    totalSales: 0,
    totalReceived: 0,
    totalDebts: 0,
    salesCount: 0,
    estimatedProfit: 0,
    retailSales: 0,
    retailOrdersCount: 0,
    wholesaleSales: 0,
    wholesaleOrdersCount: 0,
  };

  const handleExportCsv = () => {
    if (!data) return;
    exportToCsv(
      'shopino-sales-report.csv',
      ['Code', 'Product Name', 'Category', 'Units Sold', 'Sales Revenue (TOMAN)', 'Purchase Cost (TOMAN)', 'Estimated Profit (TOMAN)'],
      (data.bestProducts || []).map((p: any) => [
        p.sku,
        p.name,
        p.category,
        p.units_sold,
        p.revenue,
        p.has_cost ? p.cost_price : 'N/A',
        p.has_cost ? p.estimated_profit : 'N/A',
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.nav.reports}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {lang === 'fa'
              ? 'گزارش شفاف فروش، مبالغ دریافتی واقعی، بدهی مشتریان، مقایسه فروش تکی و عمده و سود تخمینی کالاها به تومان'
              : 'Clear sales summary, actual cash received, customer debts, retail vs. wholesale breakdown, and product profit estimate.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" icon={Download} onClick={handleExportCsv}>
            {t.common.exportCsv}
          </Button>
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            {t.common.print}
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {t.common.dateFrom}:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono dark:border-slate-700 dark:bg-slate-800"
          />
          <span className="font-semibold text-slate-600 dark:text-slate-300">{t.common.dateTo}:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <span className="text-[11px] text-slate-400">
          {lang === 'fa'
            ? '* فاکتورهای لغوشده از جمع فروش کسر شده‌اند. سود تخمینی فقط برای کالاهای دارای قیمت خرید محاسبه می‌شود.'
            : '* Cancelled sales are excluded. Estimated profit is calculated only where purchase cost is recorded.'}
        </span>
      </div>

      {/* Printable Report Container */}
      <div className="print-container space-y-6">
        {/* 4 Equal-Height Summary Cards Clearly Distinguishing Sales, Cash Received, Debts, and Estimated Profit */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title={lang === 'fa' ? 'کل فروش ثبت‌شده' : 'Total Sales'}
            value={formatCurrency(s.totalSales, lang)}
            subtitle={`${formatNumber(s.salesCount, lang)} ${
              lang === 'fa' ? 'فاکتور فروش فعال' : 'Active sales orders'
            }`}
            icon={ShoppingBag}
            tone="blue"
          />
          <MetricCard
            title={lang === 'fa' ? 'مبلغ واقعی دریافت‌شده' : 'Money Actually Received'}
            value={formatCurrency(s.totalReceived, lang)}
            subtitle={lang === 'fa' ? 'جمع وجوه نقد و کارت‌خوان' : 'Confirmed cash & POS payments'}
            icon={Wallet}
            tone="emerald"
          />
          <MetricCard
            title={lang === 'fa' ? 'مانده بدهی مشتریان' : 'Outstanding Customer Debts'}
            value={formatCurrency(s.totalDebts, lang)}
            subtitle={lang === 'fa' ? 'مطالبات نسیه تسویه‌نشده' : 'Unpaid credit balances'}
            icon={AlertCircle}
            tone="amber"
          />
          <MetricCard
            title={lang === 'fa' ? 'سود تخمینی فروش کالاها' : 'Estimated Product Profit'}
            value={formatCurrency(s.estimatedProfit, lang)}
            subtitle={
              lang === 'fa'
                ? 'فروش منهای قیمت خرید کالاها'
                : 'Based on recorded purchase costs'
            }
            icon={TrendingUp}
            tone="slate"
          />
        </div>

        {/* Retail vs Wholesale Breakdown */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold text-slate-500">{t.customerType.retail}</div>
            <div className="mt-2 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-white">
              {formatCurrency(s.retailSales, lang)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {formatNumber(s.retailOrdersCount, lang)}{' '}
              {lang === 'fa' ? 'فاکتور خرده‌فروشی' : 'Retail orders'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {t.customerType.wholesale}
            </div>
            <div className="mt-2 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-white">
              {formatCurrency(s.wholesaleSales, lang)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {formatNumber(s.wholesaleOrdersCount, lang)}{' '}
              {lang === 'fa' ? 'فاکتور عمده‌فروشی' : 'Wholesale orders'}
            </div>
          </div>
        </div>

        {/* Best-Selling Products & Profit Estimate Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'fa'
                ? 'پرفروش‌ترین کالاها و برآورد سود هر کالا'
                : 'Best-Selling Products & Profit Estimate'}
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">{t.common.loading}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-start">{lang === 'fa' ? 'کد کالا' : 'Code'}</th>
                    <th className="px-4 py-3 text-start">{lang === 'fa' ? 'نام کالا' : 'Product'}</th>
                    <th className="px-4 py-3 text-end">{lang === 'fa' ? 'تعداد فروش' : 'Qty Sold'}</th>
                    <th className="px-4 py-3 text-end">{lang === 'fa' ? 'مبلغ کل فروش' : 'Total Sales'}</th>
                    <th className="px-4 py-3 text-end">{lang === 'fa' ? 'قیمت خرید واحد' : 'Purchase Cost'}</th>
                    <th className="px-4 py-3 text-end">{lang === 'fa' ? 'سود تخمینی کالا' : 'Estimated Profit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(data?.bestProducts || []).map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono text-slate-500">{p.sku}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-end font-mono tabular-nums">
                        {formatNumber(p.units_sold, lang)}{' '}
                        {t.units[p.unit as keyof typeof t.units] || p.unit}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatCurrency(p.revenue, lang)}
                      </td>
                      <td className="px-4 py-3 text-end font-mono text-slate-500 tabular-nums">
                        {p.has_cost ? formatCurrency(p.cost_price, lang) : '—'}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                        {p.has_cost && p.estimated_profit !== null
                          ? formatCurrency(p.estimated_profit, lang)
                          : lang === 'fa'
                          ? 'قیمت خرید ثبت نشده'
                          : 'Cost not set'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sales by Day and Month */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Sales by Day */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              {lang === 'fa' ? 'فروش روزانه' : 'Sales by Day'}
            </h3>
            <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {(data?.salesByDay || []).map((row: any) => (
                <div key={row.period} className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {formatDate(row.period, lang, settings.usePersianCalendar)}
                  </span>
                  <span className="text-slate-400">
                    {formatNumber(row.count, lang)} {lang === 'fa' ? 'فاکتور' : 'orders'}
                  </span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                    {formatCurrency(row.total, lang)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sales by Month */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              {lang === 'fa' ? 'فروش ماهانه' : 'Sales by Month'}
            </h3>
            <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {(data?.salesByMonth || []).map((row: any) => (
                <div key={row.period} className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {formatDate(`${row.period}-01`, lang, settings.usePersianCalendar)}
                  </span>
                  <span className="text-slate-400">
                    {formatNumber(row.count, lang)} {lang === 'fa' ? 'فاکتور' : 'orders'}
                  </span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                    {formatCurrency(row.total, lang)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
