import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Wallet,
  AlertCircle,
  Clock,
  Download,
  Printer,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatDate, exportToCsv } from '../utils/format.ts';
import { MetricCard, Button, StatusBadge } from '../components/ui.tsx';

export const PaymentsPage: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger }) => {
  const {
    lang,
    t,
    settings,
    includeDemo,
    navigate,
    apiFetch,
    showToast,
  } = useApp();

  const [payments, setPayments] = useState<any[]>([]);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [customerFilter, setCustomerFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Inline Payment Registration Form
  const [payCustomerId, setPayCustomerId] = useState('');
  const [payOrderId, setPayOrderId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('card');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Printable Payment Receipt Modal
  const [printReceipt, setPrintReceipt] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, custRes] = await Promise.all([
        apiFetch(`/api/payments?includeDemo=${includeDemo}`),
        apiFetch(`/api/customers?includeDemo=${includeDemo}`),
      ]);
      setPayments(payRes.payments || []);
      setOpenOrders(payRes.openOrders || []);
      const activeCusts = (custRes.customers || []).filter((c: any) => c.status === 'active');
      setCustomers(activeCusts);

      if (!payCustomerId && activeCusts.length > 0) {
        const firstDebtor = activeCusts.find((c: any) => c.outstanding_balance > 0) || activeCusts[0];
        setPayCustomerId(firstDebtor.id);
        if (firstDebtor.outstanding_balance > 0) {
          setPayAmount(String(firstDebtor.outstanding_balance));
        }
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, includeDemo, payCustomerId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const selectedCustomer = customers.find((c) => c.id === payCustomerId);
  const balanceBefore = selectedCustomer ? Number(selectedCustomer.outstanding_balance || 0) : 0;
  const enteredPay = Math.max(0, Math.round(Number(payAmount || 0)));
  const balanceAfter = Math.max(0, balanceBefore - enteredPay);

  const customerOpenOrders = openOrders.filter((o) => o.customer_id === payCustomerId);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCustomerId || enteredPay <= 0) {
      showToast(t.common.requiredField, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: payCustomerId,
          order_id: payOrderId || null,
          payment_date: new Date().toISOString().slice(0, 10),
          amount: enteredPay,
          payment_type: 'collection',
          payment_method: payMethod,
          reference_number: payRef,
          notes: payNotes,
        }),
      });
      showToast(
        lang === 'fa'
          ? `دریافت وجه (${res.payment_number}) با موفقیت ثبت شد.`
          : `Payment ${res.payment_number} recorded.`,
        'success'
      );
      setPayRef('');
      setPayNotes('');
      setPayOrderId('');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (customerFilter !== 'all' && p.customer_id !== customerFilter) return false;
    if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
    if (dateFrom && p.payment_date < dateFrom) return false;
    if (dateTo && p.payment_date > dateTo) return false;
    return true;
  });

  const totalReceived = filteredPayments.reduce(
    (sum, p) => sum + (p.payment_type === 'refund' ? -p.amount : p.amount),
    0
  );
  const totalCustomerDebts = customers.reduce(
    (sum, c) => sum + (c.outstanding_balance > 0 ? c.outstanding_balance : 0),
    0
  );
  const overdueTotal = openOrders
    .filter((o) => o.is_overdue)
    .reduce((sum, o) => sum + o.outstanding_balance, 0);

  const handleExportCsv = () => {
    exportToCsv(
      'shopino-payments.csv',
      ['Receipt #', 'Date', 'Customer', 'Order #', 'Method', 'Reference', 'Amount (TOMAN)'],
      filteredPayments.map((p) => [
        p.payment_number,
        p.payment_date,
        p.customer_name,
        p.order_number || '',
        p.payment_method,
        p.reference_number || '',
        p.amount,
      ])
    );
  };

  const inputClass = 'shopino-input mt-1 w-full px-3';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="no-print shopino-glass-card flex flex-col justify-between gap-4 rounded-xl p-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#F1F5F9]">{t.nav.payments}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#94A3B8]">
            {lang === 'fa'
              ? 'ثبت دریافت وجه از مشتریان، مشاهده بدهی‌های باز و سررسیدگذشته و چاپ رسید پرداخت'
              : 'Record customer payments in Toman, track outstanding debts, and print receipts.'}
          </p>
        </div>
        <Button variant="outline" icon={Download} onClick={handleExportCsv}>
          {t.common.exportCsv}
        </Button>
      </div>

      {/* 3 Equal-Height Summary Cards */}
      <div className="no-print grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title={lang === 'fa' ? 'جمع مبالغ دریافتی' : 'Total Money Received'}
          value={formatCurrency(totalReceived, lang)}
          icon={Wallet}
          tone="emerald"
        />
        <MetricCard
          title={lang === 'fa' ? 'کل بدهی مشتریان' : 'Total Customer Debts'}
          value={formatCurrency(totalCustomerDebts, lang)}
          icon={AlertCircle}
          tone="amber"
        />
        <MetricCard
          title={lang === 'fa' ? 'بدهی‌های سررسیدگذشته' : 'Overdue Debts'}
          value={formatCurrency(overdueTotal, lang)}
          icon={Clock}
          tone={overdueTotal > 0 ? 'rose' : 'slate'}
        />
      </div>

      {/* Main Two-Column Grid: Record Payment Form + Customers with Outstanding Debts */}
      <div className="no-print grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Record Payment Card (5 cols) */}
        <div className="shopino-glass-card rounded-xl p-5 lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
            <CreditCard className="h-4 w-4 text-[#0d9488] dark:text-[#20D6C2]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
              {t.common.recordPayment}
            </h2>
          </div>

          <form onSubmit={handleRecordPayment} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'انتخاب مشتری *' : 'Select Customer *'}
              </label>
              <select
                value={payCustomerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPayCustomerId(id);
                  setPayOrderId('');
                  const c = customers.find((x) => x.id === id);
                  if (c && c.outstanding_balance > 0) {
                    setPayAmount(String(c.outstanding_balance));
                  } else {
                    setPayAmount('');
                  }
                }}
                className={inputClass}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {lang === 'fa' ? 'بدهی:' : 'Debt:'}{' '}
                    {formatCurrency(c.outstanding_balance, lang)}
                  </option>
                ))}
              </select>
            </div>

            {customerOpenOrders.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                  {lang === 'fa' ? 'بابت فاکتور مشخص (اختیاری)' : 'Link to Specific Order (Optional)'}
                </label>
                <select
                  value={payOrderId}
                  onChange={(e) => {
                    const oid = e.target.value;
                    setPayOrderId(oid);
                    const ord = customerOpenOrders.find((o) => o.id === oid);
                    if (ord) {
                      setPayAmount(String(ord.outstanding_balance));
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">
                    {lang === 'fa' ? 'کسر از کل بدهی مشتری' : 'Apply to overall customer balance'}
                  </option>
                  {customerOpenOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} ({lang === 'fa' ? 'مانده:' : 'Due:'}{' '}
                      {formatCurrency(o.outstanding_balance, lang)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Balance Before & After Payment Box */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-[#0B1220]/75">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  {lang === 'fa' ? 'بدهی قبل از پرداخت:' : 'Debt Before Payment:'}
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-amber-600 tabular-nums dark:text-amber-400">
                  {formatCurrency(balanceBefore, lang)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  {lang === 'fa' ? 'مانده بدهی پس از پرداخت:' : 'Remaining Debt After:'}
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {formatCurrency(balanceAfter, lang)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                  {lang === 'fa' ? 'مبلغ دریافتی (تومان) *' : 'Amount (TOMAN) *'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                  {lang === 'fa' ? 'روش پرداخت' : 'Payment Method'}
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className={inputClass}
                >
                  {Object.entries(t.paymentMethod).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                  {lang === 'fa' ? 'شماره پیگیری / فیش' : 'Tracking #'}
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                  {t.common.notes}
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              icon={CheckCircle2}
              disabled={submitting}
              className="w-full"
            >
              {t.common.recordPayment}
            </Button>
          </form>
        </div>

        {/* Customers with Outstanding Debts & Overdue Invoices (7 cols) */}
        <div className="shopino-glass-card rounded-xl p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
              {lang === 'fa'
                ? 'فهرست بدهی‌های باز و فاکتورهای سررسیدگذشته مشتریان'
                : 'Outstanding Customer Debts & Overdue Balances'}
            </h2>
          </div>

          {openOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
              {lang === 'fa'
                ? 'هیچ فاکتور بدهکار یا نسیه‌ای وجود ندارد.'
                : 'No unpaid credit sales found.'}
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-[#0B1220]/70 dark:text-[#94A3B8]">
                  <tr>
                    <th className="px-3 py-2.5 text-start">{lang === 'fa' ? 'مشتری' : 'Customer'}</th>
                    <th className="px-3 py-2.5 text-start">{lang === 'fa' ? 'فاکتور' : 'Order'}</th>
                    <th className="px-3 py-2.5 text-start">{lang === 'fa' ? 'سررسید' : 'Due Date'}</th>
                    <th className="px-3 py-2.5 text-end">{lang === 'fa' ? 'مانده بدهی' : 'Remaining Debt'}</th>
                    <th className="px-3 py-2.5 text-end">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {openOrders.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-[#16233B]/45">
                      <td className="px-3 py-3">
                        <button
                          onClick={() => navigate(`/customers/${o.customer_id}`)}
                          className="font-bold text-slate-900 transition-colors hover:text-[#0d9488] dark:text-[#F1F5F9] dark:hover:text-[#20D6C2]"
                        >
                          {o.customer_name}
                        </button>
                        <div className="font-mono text-[11px] text-slate-400 dark:text-[#94A3B8]">
                          {o.customer_phone || ''}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => navigate(`/orders/${o.id}`)}
                          className="font-mono font-semibold text-[#0d9488] hover:underline dark:text-[#20D6C2]"
                        >
                          {o.order_number}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-mono text-slate-600 dark:text-[#94A3B8]">
                          {formatDate(o.due_date, lang, settings.usePersianCalendar)}
                        </div>
                        {o.is_overdue && (
                          <StatusBadge
                            label={lang === 'fa' ? 'سررسیدگذشته' : 'Overdue'}
                            tone="danger"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-end font-mono font-bold text-amber-600 tabular-nums dark:text-amber-400">
                        {formatCurrency(o.outstanding_balance, lang)}
                      </td>
                      <td className="px-3 py-3 text-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPayCustomerId(o.customer_id);
                            setPayOrderId(o.id);
                            setPayAmount(String(o.outstanding_balance));
                          }}
                        >
                          {lang === 'fa' ? 'تسویه این بدهی' : 'Settle'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payment History Table */}
      <div className="no-print shopino-table-card overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
            {lang === 'fa' ? 'تاریخچه مبالغ دریافتی' : 'Payment History'}
          </h2>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="shopino-input px-3"
            >
              <option value="all">{lang === 'fa' ? 'همه مشتریان' : 'All Customers'}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="shopino-input px-3"
            >
              <option value="all">{lang === 'fa' ? 'همه روش‌های پرداخت' : 'All Methods'}</option>
              {Object.entries(t.paymentMethod).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="shopino-input px-2.5 font-mono"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="shopino-input px-2.5 font-mono"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
            {t.common.loading}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
            {t.common.noRecords}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-[#0B1220]/70 dark:text-[#94A3B8]">
                <tr>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'شماره رسید' : 'Receipt #'}</th>
                  <th className="px-4 py-3 text-start">{t.common.date}</th>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'مشتری' : 'Customer'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'فاکتور مرتبط' : 'Order'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'روش پرداخت و پیگیری' : 'Method & Ref'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'fa' ? 'مبلغ (تومان)' : 'Amount'}</th>
                  <th className="px-4 py-3 text-end">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {filteredPayments.map((p) => (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-[#16233B]/60"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-[#F1F5F9]">
                      {p.payment_number}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-[#94A3B8]">
                      {formatDate(p.payment_date, lang, settings.usePersianCalendar)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-[#F1F5F9]">
                      {p.customer_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#0d9488] dark:text-[#20D6C2]">
                      {p.order_number || '—'}
                    </td>
                    <td className="px-4 py-3 dark:text-[#F1F5F9]">
                      <div>
                        {t.paymentMethod[p.payment_method as keyof typeof t.paymentMethod] ||
                          p.payment_method}
                      </div>
                      {p.reference_number && (
                        <div className="font-mono text-[11px] text-slate-400 dark:text-[#94A3B8]">
                          {p.reference_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end font-mono font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                      {formatCurrency(p.amount, lang)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button
                        type="button"
                        onClick={() => setPrintReceipt(p)}
                        title={t.common.print}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-[#20D6C2]/40 hover:bg-slate-100 hover:text-[#0d9488] dark:border-slate-700/60 dark:text-[#94A3B8] dark:hover:border-[#20D6C2]/40 dark:hover:bg-[#16233B] dark:hover:text-[#20D6C2]"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Payment Receipt Modal */}
      {printReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050912]/70 p-4 backdrop-blur-xs">
          <div className="print-container shopino-glass-modal w-full max-w-md rounded-xl p-6">
            <div className="no-print mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'رسید دریافت وجه' : 'Payment Receipt'}
              </span>
              <button onClick={() => setPrintReceipt(null)}>
                <X className="h-4 w-4 text-slate-500 dark:text-[#94A3B8]" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="border-b border-slate-200 pb-3 text-center dark:border-slate-800">
                <div className="text-base font-bold text-slate-900 dark:text-[#F1F5F9]">
                  {lang === 'fa' ? settings.businessNameFa : settings.businessName}
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-600 dark:text-[#20D6C2]">
                  {printReceipt.payment_number}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#94A3B8]">{t.common.date}:</span>
                <span className="font-mono">
                  {formatDate(printReceipt.payment_date, lang, settings.usePersianCalendar)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#94A3B8]">
                  {lang === 'fa' ? 'پرداخت‌کننده:' : 'Customer:'}
                </span>
                <span className="font-bold">{printReceipt.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#94A3B8]">
                  {lang === 'fa' ? 'روش پرداخت:' : 'Method:'}
                </span>
                <span>
                  {t.paymentMethod[printReceipt.payment_method as keyof typeof t.paymentMethod] ||
                    printReceipt.payment_method}
                </span>
              </div>
              {printReceipt.reference_number && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-[#94A3B8]">
                    {lang === 'fa' ? 'شماره پیگیری:' : 'Reference:'}
                  </span>
                  <span className="font-mono">{printReceipt.reference_number}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-bold text-emerald-600 dark:border-slate-800 dark:text-emerald-400">
                <span>{lang === 'fa' ? 'مبلغ دریافت‌شده:' : 'Amount Received:'}</span>
                <span className="font-mono">{formatCurrency(printReceipt.amount, lang)}</span>
              </div>
            </div>

            <div className="no-print mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintReceipt(null)}>
                {t.common.close}
              </Button>
              <Button variant="primary" icon={Printer} onClick={() => window.print()}>
                {t.common.print}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
