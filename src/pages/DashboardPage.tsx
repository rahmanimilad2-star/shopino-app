import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Wallet,
  AlertCircle,
  ShoppingCart,
  Package,
  Plus,
  UserPlus,
  CreditCard,
  Eye,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatNumber, formatDate } from '../utils/format.ts';
import { MetricCard, Button, StatusBadge } from '../components/ui.tsx';

type DatePreset = 'today' | 'thisWeek' | 'thisMonth' | 'allTime' | 'custom';

export const DashboardPage: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger }) => {
  const {
    lang,
    t,
    theme,
    settings,
    includeDemo,
    setIncludeDemo,
    navigate,
    apiFetch,
    showToast,
    setQuickActionModal,
  } = useApp();

  const [preset, setPreset] = useState<DatePreset>('thisMonth');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const computeDateRange = useCallback((): { startDate: string; endDate: string } => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (preset === 'thisWeek') {
      const d = new Date(now.getTime() - 7 * 86400000);
      return { startDate: d.toISOString().slice(0, 10), endDate: todayStr };
    }
    if (preset === 'thisMonth') {
      const d = new Date(now.getTime() - 30 * 86400000);
      return { startDate: d.toISOString().slice(0, 10), endDate: todayStr };
    }
    if (preset === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    return { startDate: '2020-01-01', endDate: '2099-12-31' };
  }, [preset, customStart, customEnd]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = computeDateRange();
      const res = await apiFetch(
        `/api/dashboard?startDate=${startDate}&endDate=${endDate}&includeDemo=${includeDemo}`
      );
      setData(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, computeDateRange, includeDemo, showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshTrigger]);

  const kpis = data?.kpis || {
    todaySales: 0,
    periodSales: 0,
    todayReceived: 0,
    periodReceived: 0,
    customerDebts: 0,
    todayOrdersCount: 0,
    periodOrdersCount: 0,
    lowStockCount: 0,
  };

  const isTodaySelected = preset === 'today';
  const isDark = theme === 'dark';

  const chartTooltipStyle: React.CSSProperties = isDark
    ? {
        backgroundColor: 'rgba(17, 28, 48, 0.96)',
        borderColor: 'rgba(32, 214, 194, 0.28)',
        borderRadius: '10px',
        color: '#F1F5F9',
        fontSize: '12px',
        boxShadow: '0 12px 32px -4px rgba(2, 6, 23, 0.65)',
      }
    : {
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderRadius: '10px',
        color: '#0f172a',
        fontSize: '12px',
        boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.1)',
      };

  return (
    <div className="space-y-6">
      {/* Top Action Bar & 4 Required Shortcuts */}
      <div className="shopino-glass-card flex flex-col justify-between gap-4 rounded-xl p-5 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#F1F5F9]">{t.dashboard.title}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#94A3B8]">{t.dashboard.subtitle}</p>
        </div>

        {/* 4 Equal-Height Shortcut Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={ShoppingBag} onClick={() => navigate('/sales')}>
            {t.common.createOrder}
          </Button>
          <Button variant="outline" icon={UserPlus} onClick={() => setQuickActionModal('customer')}>
            {t.common.addCustomer}
          </Button>
          <Button variant="outline" icon={Plus} onClick={() => setQuickActionModal('product')}>
            {t.common.addProduct}
          </Button>
          <Button variant="outline" icon={CreditCard} onClick={() => setQuickActionModal('payment')}>
            {t.common.recordPayment}
          </Button>
        </div>
      </div>

      {/* Date Filter & Sample Data Bar */}
      <div className="shopino-glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'today', label: t.common.today },
              { id: 'thisWeek', label: t.common.thisWeek },
              { id: 'thisMonth', label: t.common.thisMonth },
              { id: 'allTime', label: t.common.allTime },
              { id: 'custom', label: t.common.customRange },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition-all duration-150 ${
                preset === item.id
                  ? 'bg-[#20D6C2] font-bold text-[#041417] shadow-[0_0_16px_-4px_rgba(32,214,194,0.5)]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#0B1220]/70 dark:text-[#94A3B8] dark:hover:bg-[#16233B] dark:hover:text-[#F1F5F9]'
              }`}
            >
              {item.label}
            </button>
          ))}

          {preset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="shopino-input h-8 min-h-[32px] px-2.5 font-mono text-xs"
              />
              <span className="text-slate-400 dark:text-[#94A3B8]">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="shopino-input h-8 min-h-[32px] px-2.5 font-mono text-xs"
              />
            </div>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-[#94A3B8]">
          <input
            type="checkbox"
            checked={includeDemo}
            onChange={(e) => setIncludeDemo(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-[#20D6C2] focus:ring-[#20D6C2]"
          />
          <span>{t.common.includeDemoData}</span>
        </label>
      </div>

      {/* 5 Equal-Height Metric Cards Answering the 5 Key Shop Questions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title={t.dashboard.todaySales}
          value={formatCurrency(kpis.todaySales, lang)}
          subtitle={
            !isTodaySelected
              ? `${t.dashboard.periodSales}: ${formatCurrency(kpis.periodSales, lang)}`
              : undefined
          }
          icon={ShoppingBag}
          tone="blue"
          onClick={() => navigate('/orders')}
        />
        <MetricCard
          title={t.dashboard.todayReceived}
          value={formatCurrency(kpis.todayReceived, lang)}
          subtitle={
            !isTodaySelected
              ? `${t.dashboard.periodReceived}: ${formatCurrency(kpis.periodReceived, lang)}`
              : undefined
          }
          icon={Wallet}
          tone="emerald"
          onClick={() => navigate('/payments')}
        />
        <MetricCard
          title={t.dashboard.customerDebts}
          value={formatCurrency(kpis.customerDebts, lang)}
          subtitle={
            lang === 'fa' ? 'جمع مطالبات از مشتریان بدهکار' : 'Total unpaid customer balances'
          }
          icon={AlertCircle}
          tone="amber"
          onClick={() => navigate('/payments')}
        />
        <MetricCard
          title={t.dashboard.todayOrdersCount}
          value={formatNumber(kpis.todayOrdersCount, lang)}
          subtitle={
            !isTodaySelected
              ? `${t.dashboard.periodOrdersCount}: ${formatNumber(kpis.periodOrdersCount, lang)}`
              : undefined
          }
          icon={ShoppingCart}
          tone="slate"
          onClick={() => navigate('/orders')}
        />
        <MetricCard
          title={t.dashboard.lowStockItems}
          value={formatNumber(kpis.lowStockCount, lang)}
          subtitle={lang === 'fa' ? 'نیازمند شارژ مجدد انبار' : 'Products at or below threshold'}
          icon={Package}
          tone={kpis.lowStockCount > 0 ? 'rose' : 'slate'}
          onClick={() => navigate('/products')}
        />
      </div>

      {/* 2 Simple Charts: (1) Sales Over Time, (2) Sales vs. Received Payments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: Sales Over Time */}
        <div className="shopino-glass-card rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
              {t.dashboard.salesOverTime}
            </h2>
            <span className="text-[11px] text-slate-400 dark:text-[#94A3B8]">
              {lang === 'fa' ? 'مبالغ به تومان' : 'Amounts in TOMAN'}
            </span>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chartTrend || []}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#20D6C2" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#20D6C2" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0'}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748b' }}
                  tickFormatter={(v) => formatDate(v, lang, settings.usePersianCalendar)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748b' }}
                  tickFormatter={(v) => formatNumber(v, lang)}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  itemStyle={{ color: '#20D6C2', fontWeight: 700 }}
                  formatter={(val: any) => [
                    formatCurrency(Number(val), lang),
                    lang === 'fa' ? 'فروش' : 'Sales',
                  ]}
                  labelFormatter={(l) => formatDate(String(l), lang, settings.usePersianCalendar)}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#20D6C2"
                  strokeWidth={2.4}
                  fillOpacity={1}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Sales vs. Received Payments */}
        <div className="shopino-glass-card rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
              {t.dashboard.salesVsPayments}
            </h2>
            <span className="text-[11px] text-slate-400 dark:text-[#94A3B8]">
              {lang === 'fa' ? 'فروش در برابر دریافتی نقدی' : 'Sales vs. Cash Received'}
            </span>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.chartTrend || []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0'}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748b' }}
                  tickFormatter={(v) => formatDate(v, lang, settings.usePersianCalendar)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748b' }}
                  tickFormatter={(v) => formatNumber(v, lang)}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(val: any, name: any) => [
                    formatCurrency(Number(val), lang),
                    name === 'sales'
                      ? lang === 'fa'
                        ? 'فروش ثبت‌شده'
                        : 'Total Sales'
                      : lang === 'fa'
                      ? 'مبلغ دریافت‌شده'
                      : 'Money Received',
                  ]}
                  labelFormatter={(l) => formatDate(String(l), lang, settings.usePersianCalendar)}
                />
                <Legend
                  formatter={(value) =>
                    value === 'sales'
                      ? lang === 'fa'
                        ? 'فروش ثبت‌شده'
                        : 'Sales'
                      : lang === 'fa'
                      ? 'مبلغ دریافت‌شده'
                      : 'Received'
                  }
                />
                <Bar dataKey="sales" fill="#7C83FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" fill="#20D6C2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom 3 Operational Panels: Recent Sales, Debtor Customers, Low-Stock Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 1. Recent Sales & Orders */}
        <div className="shopino-glass-card flex flex-col justify-between rounded-xl p-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
                {t.dashboard.recentSales}
              </h3>
              <button
                onClick={() => navigate('/orders')}
                className="text-xs font-semibold text-[#0d9488] hover:underline dark:text-[#20D6C2]"
              >
                {t.common.viewDetails}
              </button>
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
                {t.common.loading}
              </p>
            ) : (data?.recentOrders || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
                {t.common.noRecords}
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800/80">
                {(data?.recentOrders || []).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <button
                        onClick={() => navigate(`/orders/${o.id}`)}
                        className="font-mono font-bold text-[#0d9488] hover:underline dark:text-[#20D6C2]"
                      >
                        {o.order_number}
                      </button>
                      <div className="truncate text-slate-600 dark:text-[#F1F5F9]">
                        {o.customer_name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 dark:text-[#94A3B8]">
                        {formatDate(o.order_date, lang, settings.usePersianCalendar)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-[#F1F5F9]">
                        {formatCurrency(o.final_total, lang)}
                      </span>
                      <StatusBadge
                        label={
                          t.paymentStatus[o.payment_status as keyof typeof t.paymentStatus] ||
                          o.payment_status
                        }
                        tone={
                          o.payment_status === 'paid'
                            ? 'success'
                            : o.payment_status === 'partially_paid'
                            ? 'warning'
                            : 'danger'
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. Customers with Outstanding Debts */}
        <div className="shopino-glass-card flex flex-col justify-between rounded-xl p-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
                {t.dashboard.debtorCustomers}
              </h3>
              <button
                onClick={() => navigate('/payments')}
                className="text-xs font-semibold text-[#0d9488] hover:underline dark:text-[#20D6C2]"
              >
                {t.common.viewDetails}
              </button>
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
                {t.common.loading}
              </p>
            ) : (data?.debtorCustomers || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
                {t.common.noRecords}
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800/80">
                {(data?.debtorCustomers || []).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <button
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className="truncate font-semibold text-slate-900 transition-colors hover:text-[#0d9488] dark:text-[#F1F5F9] dark:hover:text-[#20D6C2]"
                      >
                        {c.name}
                      </button>
                      <div className="font-mono text-[11px] text-slate-400 dark:text-[#94A3B8]">
                        {c.phone || c.code}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-end">
                        <div className="font-mono font-bold text-amber-600 tabular-nums dark:text-amber-400">
                          {formatCurrency(c.outstandingBalance, lang)}
                        </div>
                        <StatusBadge label={t.paymentStatus.debtor} tone="warning" />
                      </div>
                      <button
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-[#20D6C2]/40 hover:bg-slate-100 hover:text-[#0d9488] dark:border-slate-700/60 dark:text-[#94A3B8] dark:hover:border-[#20D6C2]/40 dark:hover:bg-[#16233B] dark:hover:text-[#20D6C2]"
                        title={t.common.viewDetails}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Products Running Low */}
        <div className="shopino-glass-card flex flex-col justify-between rounded-xl p-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
                {t.dashboard.lowStockList}
              </h3>
              <button
                onClick={() => navigate('/products')}
                className="text-xs font-semibold text-[#0d9488] hover:underline dark:text-[#20D6C2]"
              >
                {t.common.viewDetails}
              </button>
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
                {t.common.loading}
              </p>
            ) : (data?.lowStockProducts || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
                {lang === 'fa' ? 'موجودی تمامی کالاها کافی است.' : 'All products are well stocked.'}
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800/80">
                {(data?.lowStockProducts || []).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 dark:text-[#F1F5F9]">
                        {p.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 dark:text-[#94A3B8]">
                        {p.sku} · {p.category}
                      </div>
                    </div>
                    <div className="text-end">
                      <StatusBadge
                        label={`${formatNumber(p.stock_quantity, lang)} ${
                          t.units[p.unit as keyof typeof t.units] || p.unit
                        }`}
                        tone="danger"
                      />
                      <div className="mt-1 text-[10px] text-slate-400 dark:text-[#94A3B8]">
                        {lang === 'fa'
                          ? `حداقل مجاز: ${formatNumber(p.min_stock_threshold, lang)}`
                          : `Min: ${p.min_stock_threshold}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
