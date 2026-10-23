import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  Wallet,
  AlertCircle,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatDate } from '../utils/format.ts';
import { MetricCard, Button, StatusBadge } from '../components/ui.tsx';

export const CustomerDetailPage: React.FC<{ customerId: string }> = ({ customerId }) => {
  const { lang, dir, t, settings, navigate, apiFetch, showToast } = useApp();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('card');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/customers/${customerId}`);
      setData(res);
      if (res.customer.outstanding_balance > 0) {
        setPayAmount(String(res.customer.outstanding_balance));
      } else {
        setPayAmount('');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, customerId, showToast]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round(Number(payAmount || 0));
    if (amt <= 0) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          payment_date: new Date().toISOString().slice(0, 10),
          amount: amt,
          payment_type: 'collection',
          payment_method: payMethod,
          reference_number: payRef,
          notes: payNotes || 'تسویه بدهی مشتری',
        }),
      });
      showToast(
        lang === 'fa'
          ? 'دریافت وجه با موفقیت ثبت شد و از بدهی مشتری کسر گردید.'
          : 'Payment recorded against customer balance.',
        'success'
      );
      setPayRef('');
      setPayNotes('');
      loadCustomer();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  if (loading || !data) {
    return <div className="p-8 text-center text-xs text-slate-500">{t.common.loading}</div>;
  }

  const c = data.customer;
  const orders = data.orders || [];
  const payments = data.payments || [];

  const balanceBefore = Number(c.outstanding_balance || 0);
  const enteredPay = Math.max(0, Math.round(Number(payAmount || 0)));
  const balanceAfter = Math.max(0, balanceBefore - enteredPay);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/customers')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <BackIcon className="h-4 w-4" />
          <span>{t.common.backToList}</span>
        </button>

        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            {lang === 'fa' ? 'چاپ صورت‌حساب مشتری' : 'Print Statement'}
          </Button>
          <Button variant="primary" icon={ShoppingBag} onClick={() => navigate('/sales')}>
            {t.common.createOrder}
          </Button>
        </div>
      </div>

      {/* Printable Customer Header & Summary */}
      <div className="print-container space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{c.name}</h1>
                <StatusBadge
                  label={
                    c.customer_type === 'wholesale' ? t.customerType.wholesale : t.customerType.retail
                  }
                  tone={c.customer_type === 'wholesale' ? 'info' : 'neutral'}
                />
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                <span className="font-mono">{c.code}</span>
                {c.phone && <span className="font-mono"> · {c.phone}</span>}
                {c.address && <span> · {c.address}</span>}
              </div>
              {c.notes && <div className="mt-1 text-xs text-slate-400">{c.notes}</div>}
            </div>

            <div className="text-xs text-slate-500">
              {lang === 'fa' ? 'آخرین فعالیت:' : 'Latest Activity:'}{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {formatDate(c.last_activity || c.created_at, lang, settings.usePersianCalendar)}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Equal-Height Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            title={lang === 'fa' ? 'کل خرید مشتری' : 'Total Purchases'}
            value={formatCurrency(c.total_purchases, lang)}
            icon={ShoppingBag}
            tone="blue"
          />
          <MetricCard
            title={lang === 'fa' ? 'کل پرداختی مشتری' : 'Total Payments'}
            value={formatCurrency(c.total_payments, lang)}
            icon={Wallet}
            tone="emerald"
          />
          <MetricCard
            title={t.common.balance}
            value={formatCurrency(c.outstanding_balance, lang)}
            icon={AlertCircle}
            tone={c.outstanding_balance > 0 ? 'amber' : 'slate'}
          />
        </div>

        {/* Register Payment Against Customer Balance */}
        <div className="no-print rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {lang === 'fa'
              ? 'ثبت دریافت وجه از این مشتری (کسر از بدهی)'
              : 'Record Payment From Customer'}
          </h2>
          <form onSubmit={handleRecordPayment} className="mt-4 space-y-4 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'مبلغ دریافتی (تومان) *' : 'Amount (TOMAN) *'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'روش پرداخت' : 'Payment Method'}
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {Object.entries(t.paymentMethod).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'شماره پیگیری (اختیاری)' : 'Ref # (Optional)'}
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {t.common.notes}
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-2.5 dark:bg-slate-800/50">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span>
                  {lang === 'fa' ? 'بدهی فعلی:' : 'Current Debt:'}{' '}
                  <strong className="font-mono text-amber-600">
                    {formatCurrency(balanceBefore, lang)}
                  </strong>
                </span>
                <span>→</span>
                <span>
                  {lang === 'fa' ? 'مانده پس از این پرداخت:' : 'Debt After Payment:'}{' '}
                  <strong className="font-mono text-emerald-600">
                    {formatCurrency(balanceAfter, lang)}
                  </strong>
                </span>
              </div>
              <Button type="submit" variant="primary" icon={CheckCircle2} disabled={submitting}>
                {t.common.recordPayment}
              </Button>
            </div>
          </form>
        </div>

        {/* Sales History & Payment History */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Customer Sales History */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              {lang === 'fa' ? 'سوابق خرید و سفارش‌ها' : 'Sales & Order History'}
            </h3>
            {orders.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">{t.common.noRecords}</p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
                {orders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <button
                        onClick={() => navigate(`/orders/${o.id}`)}
                        className="font-mono font-bold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {o.order_number}
                      </button>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {formatDate(o.order_date, lang, settings.usePersianCalendar)}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatCurrency(o.final_total, lang)}
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1.5">
                        <StatusBadge
                          label={
                            t.orderStatus[o.status as keyof typeof t.orderStatus] || o.status
                          }
                          tone={o.status === 'cancelled' ? 'danger' : 'neutral'}
                        />
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Payment History */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              {lang === 'fa' ? 'سوابق پرداخت‌های مشتری' : 'Payment History'}
            </h3>
            {payments.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">{t.common.noRecords}</p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {p.payment_number}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        <span className="font-mono">
                          {formatDate(p.payment_date, lang, settings.usePersianCalendar)}
                        </span>
                        {' · '}
                        {t.paymentMethod[p.payment_method as keyof typeof t.paymentMethod] ||
                          p.payment_method}
                        {p.order_number ? ` · ${p.order_number}` : ''}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                      {formatCurrency(p.amount, lang)}
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
