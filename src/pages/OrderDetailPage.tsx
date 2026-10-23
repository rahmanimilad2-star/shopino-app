import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Printer,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatNumber, formatDate } from '../utils/format.ts';
import { Button, StatusBadge } from '../components/ui.tsx';

export const OrderDetailPage: React.FC<{ orderId: string }> = ({ orderId }) => {
  const { lang, dir, t, settings, navigate, apiFetch, showToast, requestConfirm } = useApp();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('card');
  const [payRef, setPayRef] = useState('');

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/orders/${orderId}`);
      setData(res);
      setNewStatus(res.order.status);
      if (res.order.outstanding_balance > 0) {
        setPayAmount(String(res.order.outstanding_balance));
      } else {
        setPayAmount('');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, orderId, showToast]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const executeStatusUpdate = async () => {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(
        lang === 'fa'
          ? 'وضعیت سفارش و موجودی انبار به‌روزرسانی شد.'
          : 'Order status and stock updated.',
        'success'
      );
      loadOrder();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStatusUpdate = () => {
    if (newStatus === 'cancelled') {
      requestConfirm({
        title: lang === 'fa' ? 'تأیید لغو فاکتور' : 'Confirm Order Cancellation',
        message:
          lang === 'fa'
            ? 'آیا از لغو این فاکتور اطمینان دارید؟ کالاهای این فاکتور به موجودی انبار بازگردانده شده و از جمع فروش کسر می‌گردد.'
            : 'Are you sure you want to cancel this order? Deducted stock will be returned to inventory.',
        confirmLabel: t.common.confirm,
        variant: 'danger',
        onConfirm: executeStatusUpdate,
      });
    } else {
      executeStatusUpdate();
    }
  };

  const handleRecordOrderPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round(Number(payAmount || 0));
    if (amt <= 0 || !data?.order?.customer_id) return;
    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: data.order.customer_id,
          order_id: data.order.id,
          payment_date: new Date().toISOString().slice(0, 10),
          amount: amt,
          payment_type: 'collection',
          payment_method: payMethod,
          reference_number: payRef,
          notes: `تسویه فاکتور ${data.order.order_number}`,
        }),
      });
      showToast(lang === 'fa' ? 'دریافت وجه با موفقیت ثبت شد.' : 'Payment recorded.', 'success');
      setPayRef('');
      loadOrder();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
        {t.common.loading}
      </div>
    );
  }

  const o = data.order;
  const items = data.items || [];
  const payments = data.payments || [];

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/orders')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F1F5F9]"
        >
          <BackIcon className="h-4 w-4" />
          <span>{t.common.backToList}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <div className="shopino-glass-card flex h-10 items-center gap-2 rounded-lg px-3 text-xs">
            <span className="text-slate-500 dark:text-[#94A3B8]">
              {lang === 'fa' ? 'وضعیت سفارش:' : 'Order Status:'}
            </span>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="bg-transparent font-semibold text-slate-900 focus:outline-none dark:text-[#F1F5F9]"
            >
              {Object.entries(t.orderStatus).map(([k, v]) => (
                <option key={k} value={k} className="dark:bg-[#111C30]">
                  {v}
                </option>
              ))}
            </select>
            {newStatus !== o.status && (
              <Button size="sm" variant="primary" onClick={handleStatusUpdate}>
                {t.common.save}
              </Button>
            )}
          </div>

          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            {t.common.print}
          </Button>
        </div>
      </div>

      {/* Printable Receipt / Invoice Container */}
      <div className="print-container shopino-glass-card rounded-xl p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 border-b border-slate-200/80 pb-6 sm:flex-row dark:border-slate-800">
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-[#F1F5F9]">
              {lang === 'fa' ? settings.businessNameFa : settings.businessName}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-[#94A3B8]">
              {lang === 'fa' ? settings.addressFa : settings.addressEn}
            </div>
            <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-[#94A3B8]">
              {settings.phone}
            </div>
          </div>

          <div className="text-start sm:text-end">
            <div className="text-xs font-bold text-[#0d9488] dark:text-[#20D6C2]">
              {lang === 'fa' ? 'رسید فروش و صورت‌حساب کالا' : 'SALES RECEIPT & INVOICE'}
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-[#F1F5F9]">
              {o.order_number}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-[#94A3B8]">
              {t.common.date}:{' '}
              <span className="font-mono">
                {formatDate(o.order_date, lang, settings.usePersianCalendar)}
              </span>
            </div>
          </div>
        </div>

        {/* Customer & Status Row */}
        <div className="mt-6 grid grid-cols-1 gap-6 border-b border-slate-200/80 pb-6 sm:grid-cols-2 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-slate-400 dark:text-[#94A3B8]">
              {lang === 'fa' ? 'مشخصات خریدار' : 'Customer'}
            </div>
            {o.customer_id ? (
              <button
                onClick={() => navigate(`/customers/${o.customer_id}`)}
                className="mt-1 text-sm font-bold text-slate-900 transition-colors hover:text-[#0d9488] dark:text-[#F1F5F9] dark:hover:text-[#20D6C2]"
              >
                {o.customer_name}
              </button>
            ) : (
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
                {o.customer_name}
              </div>
            )}
            <div className="mt-1 font-mono text-xs text-slate-500 dark:text-[#94A3B8]">
              {o.customer_phone !== '—' ? o.customer_phone : ''}
            </div>
          </div>

          <div className="flex flex-col justify-center gap-2 sm:items-end">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-[#94A3B8]">
                {lang === 'fa' ? 'وضعیت سفارش:' : 'Order Status:'}
              </span>
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
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-[#94A3B8]">
                {lang === 'fa' ? 'وضعیت پرداخت:' : 'Payment Status:'}
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
        </div>

        {/* Line Items Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-[#0B1220]/70 dark:text-[#94A3B8]">
              <tr>
                <th className="px-3 py-2.5 text-start">#</th>
                <th className="px-3 py-2.5 text-start">{lang === 'fa' ? 'کد کالا' : 'Code'}</th>
                <th className="px-3 py-2.5 text-start">{lang === 'fa' ? 'شرح کالا' : 'Product'}</th>
                <th className="px-3 py-2.5 text-end">{lang === 'fa' ? 'تعداد' : 'Qty'}</th>
                <th className="px-3 py-2.5 text-end">{lang === 'fa' ? 'فی واحد (تومان)' : 'Unit Price'}</th>
                <th className="px-3 py-2.5 text-end">{lang === 'fa' ? 'مبلغ کل ردیف' : 'Line Total'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {items.map((item: any, idx: number) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-mono text-slate-400 dark:text-[#94A3B8]">
                    {formatNumber(idx + 1, lang)}
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-500 dark:text-[#94A3B8]">{item.sku}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900 dark:text-[#F1F5F9]">
                    {item.product_name}
                  </td>
                  <td className="px-3 py-3 text-end font-mono tabular-nums">
                    {formatNumber(item.quantity, lang)}
                  </td>
                  <td className="px-3 py-3 text-end font-mono tabular-nums">
                    {formatCurrency(item.unit_price, lang)}
                  </td>
                  <td className="px-3 py-3 text-end font-mono font-bold text-slate-900 tabular-nums dark:text-[#F1F5F9]">
                    {formatCurrency(item.line_total, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="mt-6 flex flex-col justify-between gap-6 border-t border-slate-200/80 pt-6 sm:flex-row dark:border-slate-800">
          <div className="max-w-md text-xs text-slate-500 dark:text-[#94A3B8]">
            <div className="font-semibold text-slate-700 dark:text-[#F1F5F9]">{t.common.notes}:</div>
            <p className="mt-1">
              {o.notes || (lang === 'fa' ? 'بدون توضیحات اضافی' : 'No additional notes.')}
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-[#94A3B8]">
                {lang === 'fa' ? 'جمع اقلام:' : 'Subtotal:'}
              </span>
              <span className="font-mono tabular-nums">{formatCurrency(o.subtotal, lang)}</span>
            </div>
            {(o.item_discount > 0 || o.order_discount > 0) && (
              <div className="flex justify-between text-slate-500 dark:text-[#94A3B8]">
                <span>{lang === 'fa' ? 'تخفیف:' : 'Discount:'}</span>
                <span className="font-mono tabular-nums">
                  -{formatCurrency(o.item_discount + o.order_discount, lang)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-[#F1F5F9]">
              <span>{lang === 'fa' ? 'مبلغ نهایی فاکتور:' : 'Final Total:'}</span>
              <span className="font-mono text-[#0d9488] tabular-nums dark:text-[#20D6C2]">
                {formatCurrency(o.final_total, lang)}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
              <span>{lang === 'fa' ? 'مبلغ دریافت‌شده:' : 'Amount Received:'}</span>
              <span className="font-mono tabular-nums">{formatCurrency(o.amount_paid, lang)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-amber-600 dark:border-slate-800 dark:text-amber-400">
              <span>{t.common.balance}:</span>
              <span className="font-mono tabular-nums">{formatCurrency(o.outstanding_balance, lang)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Payments & Quick Balance Settlement */}
      <div className="no-print shopino-glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
          <CreditCard className="h-4 w-4 text-[#0d9488] dark:text-[#20D6C2]" />
          <span>
            {lang === 'fa' ? 'پرداخت‌های ثبت‌شده برای این فاکتور' : 'Payments Recorded for This Order'}
          </span>
        </div>

        <div className="mt-3 divide-y divide-slate-200 text-xs dark:divide-slate-800">
          {payments.length === 0 ? (
            <p className="py-3 text-slate-500 dark:text-[#94A3B8]">{t.common.noRecords}</p>
          ) : (
            payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-[#F1F5F9]">
                    {p.payment_number}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                    {formatDate(p.payment_date, lang, settings.usePersianCalendar)} ·{' '}
                    {t.paymentMethod[p.payment_method as keyof typeof t.paymentMethod] ||
                      p.payment_method}
                  </div>
                </div>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(p.amount, lang)}
                </div>
              </div>
            ))
          )}
        </div>

        {o.outstanding_balance > 0 && o.status !== 'cancelled' && o.customer_id && (
          <form
            onSubmit={handleRecordOrderPayment}
            className="mt-4 space-y-3 border-t border-slate-200/80 pt-4 text-xs dark:border-slate-800"
          >
            <div className="font-semibold text-slate-800 dark:text-[#F1F5F9]">
              {lang === 'fa' ? 'ثبت دریافت وجه برای تسویه مانده این فاکتور' : 'Record Payment Against Balance'}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="number"
                required
                min="1"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={t.common.amount}
                className="shopino-input px-3 font-mono"
              />
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="shopino-input px-3"
              >
                {Object.entries(t.paymentMethod).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder={lang === 'fa' ? 'شماره پیگیری' : 'Reference #'}
                className="shopino-input px-3 font-mono"
              />
            </div>
            <Button type="submit" variant="primary" icon={CheckCircle2}>
              {t.common.recordPayment}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
