import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/format.ts';
import { Button } from './ui.tsx';

export const QuickModals: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const {
    lang,
    t,
    settings,
    includeDemo,
    quickActionModal,
    setQuickActionModal,
    apiFetch,
    showToast,
  } = useApp();

  // Add Customer Form
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custType, setCustType] = useState<'retail' | 'wholesale'>('retail');
  const [custAddress, setCustAddress] = useState('');
  const [custNotes, setCustNotes] = useState('');

  // Add Product Form
  const [prdName, setPrdName] = useState('');
  const [prdSku, setPrdSku] = useState('');
  const [prdCat, setPrdCat] = useState(settings.productCategories[0] || 'عمومی');
  const [prdUnit, setPrdUnit] = useState('piece');
  const [prdCost, setPrdCost] = useState('');
  const [prdRetail, setPrdRetail] = useState('');
  const [prdWholesale, setPrdWholesale] = useState('');
  const [prdStock, setPrdStock] = useState('10');
  const [prdMinStock, setPrdMinStock] = useState(String(settings.lowStockThresholdDefault || 5));

  // Record Payment Form
  const [customers, setCustomers] = useState<any[]>([]);
  const [payCustomerId, setPayCustomerId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('card');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (quickActionModal === 'payment') {
      apiFetch(`/api/customers?includeDemo=${includeDemo}`)
        .then((res) => {
          const active = (res.customers || []).filter((c: any) => c.status === 'active');
          setCustomers(active);
          const debtor = active.find((c: any) => c.outstanding_balance > 0) || active[0];
          if (debtor) {
            setPayCustomerId(debtor.id);
            if (debtor.outstanding_balance > 0) {
              setPayAmount(String(debtor.outstanding_balance));
            }
          }
        })
        .catch(() => {});
    }
  }, [quickActionModal, apiFetch, includeDemo]);

  if (!quickActionModal) return null;

  const selectedCustomer = customers.find((c) => c.id === payCustomerId);
  const balanceBefore = selectedCustomer ? Number(selectedCustomer.outstanding_balance || 0) : 0;
  const enteredPay = Math.max(0, Math.round(Number(payAmount || 0)));
  const balanceAfter = Math.max(0, balanceBefore - enteredPay);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      showToast(t.common.requiredField, 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: custName,
          phone: custPhone,
          customer_type: custType,
          address: custAddress,
          notes: custNotes,
        }),
      });
      showToast(
        lang === 'fa' ? 'مشتری جدید با موفقیت ثبت شد.' : 'Customer added successfully.',
        'success'
      );
      setCustName('');
      setCustPhone('');
      setCustAddress('');
      setCustNotes('');
      setQuickActionModal(null);
      onSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prdName.trim() || !prdRetail) {
      showToast(t.common.requiredField, 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: prdName,
          name_fa: prdName,
          sku: prdSku,
          category: prdCat,
          unit: prdUnit,
          cost_price: Number(prdCost || 0),
          sale_price: Number(prdRetail),
          wholesale_price: Number(prdWholesale || prdRetail),
          stock_quantity: Number(prdStock || 0),
          min_stock_threshold: Number(prdMinStock || 5),
        }),
      });
      showToast(
        lang === 'fa' ? 'کالای جدید با موفقیت ثبت شد.' : 'Product added successfully.',
        'success'
      );
      setPrdName('');
      setPrdSku('');
      setPrdCost('');
      setPrdRetail('');
      setPrdWholesale('');
      setQuickActionModal(null);
      onSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCustomerId || enteredPay <= 0) {
      showToast(t.common.requiredField, 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: payCustomerId,
          payment_date: new Date().toISOString().slice(0, 10),
          amount: enteredPay,
          payment_type: 'collection',
          payment_method: payMethod,
          reference_number: payRef,
          notes: payNotes,
        }),
      });
      showToast(
        lang === 'fa' ? 'دریافت وجه با موفقیت ثبت شد و از بدهی مشتری کسر گردید.' : 'Payment recorded.',
        'success'
      );
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      setQuickActionModal(null);
      onSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'shopino-input mt-1 w-full px-3';

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#050912]/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="shopino-glass-modal my-8 w-full max-w-lg rounded-xl p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3.5 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-[#F1F5F9]">
            {quickActionModal === 'customer' && t.common.addCustomer}
            {quickActionModal === 'product' && t.common.addProduct}
            {quickActionModal === 'payment' && t.common.recordPayment}
          </h3>
          <button
            type="button"
            onClick={() => setQuickActionModal(null)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#16233B]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. ADD CUSTOMER MODAL */}
        {quickActionModal === 'customer' && (
          <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fa' ? 'نام مشتری یا فروشگاه *' : 'Customer / Shop Name *'}
              </label>
              <input
                type="text"
                required
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                placeholder={lang === 'fa' ? 'مثلاً: سوپرمارکت بهاران / علی رضایی' : 'e.g. Ali Rezaei'}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'شماره تماس (اختیاری)' : 'Phone Number (Optional)'}
                </label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="0912..."
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'نوع خرید مشتری' : 'Customer Type'}
                </label>
                <select
                  value={custType}
                  onChange={(e) => setCustType(e.target.value as 'retail' | 'wholesale')}
                  className={inputClass}
                >
                  <option value="retail">{t.customerType.retail}</option>
                  <option value="wholesale">{t.customerType.wholesale}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fa' ? 'نشانی (اختیاری)' : 'Address (Optional)'}
              </label>
              <input
                type="text"
                value={custAddress}
                onChange={(e) => setCustAddress(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fa' ? 'یادداشت کوتاه (اختیاری)' : 'Short Note (Optional)'}
              </label>
              <input
                type="text"
                value={custNotes}
                onChange={(e) => setCustNotes(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setQuickActionModal(null)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {t.common.save}
              </Button>
            </div>
          </form>
        )}

        {/* 2. ADD PRODUCT MODAL */}
        {quickActionModal === 'product' && (
          <form onSubmit={handleCreateProduct} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fa' ? 'نام کالا *' : 'Product Name *'}
              </label>
              <input
                type="text"
                required
                value={prdName}
                onChange={(e) => setPrdName(e.target.value)}
                placeholder={lang === 'fa' ? 'مثلاً: قهوه اسپرسو ۱ کیلویی' : 'Product Name'}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'کد کالا (اختیاری)' : 'Code (Optional)'}
                </label>
                <input
                  type="text"
                  value={prdSku}
                  onChange={(e) => setPrdSku(e.target.value)}
                  placeholder="P-1008"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'دسته‌بندی' : 'Category'}
                </label>
                <select
                  value={prdCat}
                  onChange={(e) => setPrdCat(e.target.value)}
                  className={inputClass}
                >
                  {settings.productCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'واحد شمارش' : 'Unit'}
                </label>
                <select
                  value={prdUnit}
                  onChange={(e) => setPrdUnit(e.target.value)}
                  className={inputClass}
                >
                  {Object.entries(t.units).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'قیمت خرید (تومان)' : 'Purchase Cost (TOMAN)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={prdCost}
                  onChange={(e) => setPrdCost(e.target.value)}
                  placeholder="780000"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'قیمت خرده‌فروشی (تومان) *' : 'Retail Price (TOMAN) *'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={prdRetail}
                  onChange={(e) => setPrdRetail(e.target.value)}
                  placeholder="1150000"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'قیمت عمده‌فروشی (تومان)' : 'Wholesale Price (TOMAN)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={prdWholesale}
                  onChange={(e) => setPrdWholesale(e.target.value)}
                  placeholder="980000"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'موجودی فعلی' : 'Current Stock'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={prdStock}
                  onChange={(e) => setPrdStock(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'حداقل موجودی (هشدار)' : 'Low-Stock Threshold'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={prdMinStock}
                  onChange={(e) => setPrdMinStock(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setQuickActionModal(null)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {t.common.save}
              </Button>
            </div>
          </form>
        )}

        {/* 3. RECORD PAYMENT MODAL */}
        {quickActionModal === 'payment' && (
          <form onSubmit={handleRecordPayment} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fa' ? 'انتخاب مشتری *' : 'Select Customer *'}
              </label>
              <select
                value={payCustomerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPayCustomerId(id);
                  const found = customers.find((c) => c.id === id);
                  if (found && found.outstanding_balance > 0) {
                    setPayAmount(String(found.outstanding_balance));
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

            {/* Balance Before & After Preview */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-[#0B1220]/70">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  {lang === 'fa' ? 'بدهی قبل از پرداخت:' : 'Debt Before Payment:'}
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(balanceBefore, lang)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  {lang === 'fa' ? 'مانده بدهی پس از پرداخت:' : 'Remaining Debt After:'}
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(balanceAfter, lang)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'مبلغ دریافتی (تومان) *' : 'Received Amount (TOMAN) *'}
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
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'روش دریافت وجه' : 'Payment Method'}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'شماره پیگیری / فیش (اختیاری)' : 'Reference # (Optional)'}
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className={`${inputClass} font-mono`}
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
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setQuickActionModal(null)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {t.common.save}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
