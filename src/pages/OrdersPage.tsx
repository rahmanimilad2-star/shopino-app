import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Search,
  Download,
  Eye,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatDate, exportToCsv } from '../utils/format.ts';
import { Button, StatusBadge } from '../components/ui.tsx';

export const OrdersPage: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger }) => {
  const {
    lang,
    t,
    settings,
    includeDemo,
    navigate,
    apiFetch,
    showToast,
  } = useApp();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/orders?includeDemo=${includeDemo}`);
      setOrders(res.orders || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, includeDemo, showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders, refreshTrigger]);

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (paymentFilter !== 'all' && o.payment_status !== paymentFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleExportCsv = () => {
    exportToCsv(
      'shopino-orders.csv',
      ['Order #', 'Date', 'Customer', 'Pricing', 'Order Status', 'Payment Status', 'Final Total (TOMAN)', 'Amount Paid (TOMAN)', 'Remaining Debt (TOMAN)'],
      filtered.map((o) => [
        o.order_number,
        o.order_date,
        o.customer_name,
        o.pricing_type,
        o.status,
        o.payment_status,
        o.final_total,
        o.amount_paid,
        o.outstanding_balance,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.nav.orders}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {lang === 'fa'
              ? 'فهرست تمامی فروش‌ها و سفارش‌ها، وضعیت آماده‌سازی، وضعیت تسویه و چاپ رسید فروش'
              : 'View all sales orders, fulfillment statuses, payment balances, and printable receipts.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" icon={Download} onClick={handleExportCsv}>
            {t.common.exportCsv}
          </Button>
          <Button variant="primary" icon={ShoppingBag} onClick={() => navigate('/sales')}>
            {t.common.createOrder}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'fa'
                ? 'جستجوی شماره فاکتور یا نام مشتری...'
                : 'Search order number or customer name...'
            }
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 ps-9 pe-3 text-xs focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">{lang === 'fa' ? 'همه وضعیت‌های سفارش' : 'All Order Statuses'}</option>
            <option value="registered">{t.orderStatus.registered}</option>
            <option value="preparing">{t.orderStatus.preparing}</option>
            <option value="completed">{t.orderStatus.completed}</option>
            <option value="cancelled">{t.orderStatus.cancelled}</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">{lang === 'fa' ? 'همه وضعیت‌های پرداخت' : 'All Payment Statuses'}</option>
            <option value="paid">{t.paymentStatus.paid}</option>
            <option value="partially_paid">{t.paymentStatus.partially_paid}</option>
            <option value="unpaid">{t.paymentStatus.unpaid}</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">{t.common.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">{t.common.noRecords}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'شماره فاکتور' : 'Order #'}</th>
                  <th className="px-4 py-3 text-start">{t.common.date}</th>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'مشتری و نوع فروش' : 'Customer'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'وضعیت سفارش' : 'Order Status'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'وضعیت پرداخت' : 'Payment Status'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'fa' ? 'مبلغ کل' : 'Final Total'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'fa' ? 'دریافتی' : 'Received'}</th>
                  <th className="px-4 py-3 text-end">{t.common.balance}</th>
                  <th className="px-4 py-3 text-end">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/orders/${o.id}`)}
                        className="font-mono font-bold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {o.order_number}
                      </button>
                      {o.is_demo ? (
                        <div className="text-[10px] text-slate-400">{t.common.sampleRecord}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {formatDate(o.order_date, lang, settings.usePersianCalendar)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {o.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {o.pricing_type === 'wholesale'
                          ? t.customerType.wholesale
                          : t.customerType.retail}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={t.orderStatus[o.status as keyof typeof t.orderStatus] || o.status}
                        tone={
                          o.status === 'completed'
                            ? 'success'
                            : o.status === 'cancelled'
                            ? 'danger'
                            : 'info'
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 text-end font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                      {formatCurrency(o.final_total, lang)}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-emerald-600 tabular-nums dark:text-emerald-400">
                      {formatCurrency(o.amount_paid, lang)}
                    </td>
                    <td
                      className={`px-4 py-3 text-end font-mono font-bold tabular-nums ${
                        o.outstanding_balance > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatCurrency(o.outstanding_balance, lang)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button
                        type="button"
                        onClick={() => navigate(`/orders/${o.id}`)}
                        title={t.common.viewDetails}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
