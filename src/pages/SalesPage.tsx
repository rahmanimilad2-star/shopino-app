import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  UserPlus,
  CheckCircle2,
  Printer,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatNumber, formatDate } from '../utils/format.ts';
import { Button, StatusBadge } from '../components/ui.tsx';

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  stock_quantity: number;
  retail_price: number;
  wholesale_price: number;
  unit_price: number;
  quantity: number;
}

export const SalesPage: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger }) => {
  const {
    lang,
    t,
    settings,
    includeDemo,
    navigate,
    apiFetch,
    showToast,
    setQuickActionModal,
  } = useApp();

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Catalog Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Sale State
  const [customerId, setCustomerId] = useState<string>('walk-in');
  const [pricingType, setPricingType] = useState<'retail' | 'wholesale'>(
    settings.defaultPricingType || 'retail'
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<string>('0');
  const [paymentMode, setPaymentMode] = useState<'paid' | 'partially_paid' | 'unpaid'>('paid');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<'completed' | 'registered' | 'preparing'>('completed');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Completed Sale Receipt Preview Modal
  const [savedReceipt, setSavedReceipt] = useState<any | null>(null);

  const loadCatalogAndCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        apiFetch(`/api/products?includeDemo=${includeDemo}`),
        apiFetch(`/api/customers?includeDemo=${includeDemo}`),
      ]);
      setProducts((pRes.products || []).filter((p: any) => p.status === 'active'));
      setCustomers((cRes.customers || []).filter((c: any) => c.status === 'active'));
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, includeDemo, showToast]);

  useEffect(() => {
    loadCatalogAndCustomers();
  }, [loadCatalogAndCustomers, refreshTrigger]);

  // When customer changes, suggest wholesale pricing if wholesale customer
  const handleSelectCustomer = (newCustId: string) => {
    setCustomerId(newCustId);
    if (newCustId === 'walk-in') {
      // Walk-in customers must pay in full
      setPaymentMode('paid');
      applyPricingMode('retail');
      return;
    }
    const found = customers.find((c) => c.id === newCustId);
    if (found) {
      const suggestedMode = found.customer_type === 'wholesale' ? 'wholesale' : 'retail';
      applyPricingMode(suggestedMode);
    }
  };

  const applyPricingMode = (mode: 'retail' | 'wholesale') => {
    setPricingType(mode);
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        unit_price:
          mode === 'wholesale' && item.wholesale_price > 0
            ? item.wholesale_price
            : item.retail_price,
      }))
    );
  };

  const addToCart = (product: any) => {
    if (settings.enableInventoryTracking && product.stock_quantity <= 0) {
      showToast(
        lang === 'fa'
          ? `موجودی کالای «${product.name}» در انبار به پایان رسیده است.`
          : `"${product.name}" is out of stock.`,
        'error'
      );
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.product_id === product.id);
      if (existingIdx > -1) {
        const currentQty = prev[existingIdx].quantity;
        if (settings.enableInventoryTracking && currentQty + 1 > product.stock_quantity) {
          showToast(
            lang === 'fa'
              ? `حداکثر موجودی قابل فروش: ${formatNumber(product.stock_quantity, lang)}`
              : `Maximum available stock: ${product.stock_quantity}`,
            'error'
          );
          return prev;
        }
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], quantity: currentQty + 1 };
        return copy;
      }

      const defaultUnitPrice =
        pricingType === 'wholesale' && product.wholesale_price > 0
          ? product.wholesale_price
          : product.sale_price;

      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit || 'piece',
          stock_quantity: product.stock_quantity,
          retail_price: product.sale_price,
          wholesale_price: product.wholesale_price || product.sale_price,
          unit_price: defaultUnitPrice,
          quantity: 1,
        },
      ];
    });
  };

  const updateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((i) => i.product_id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        if (settings.enableInventoryTracking && newQty > item.stock_quantity) {
          showToast(
            lang === 'fa'
              ? `موجودی انبار کافی نیست (موجودی: ${formatNumber(item.stock_quantity, lang)})`
              : `Insufficient stock (Available: ${item.stock_quantity})`,
            'error'
          );
          return item;
        }
        return { ...item, quantity: newQty };
      })
    );
  };

  const updateCartPrice = (productId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, unit_price: Math.max(0, Math.round(newPrice)) } : item
      )
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const discountVal = Math.max(0, Math.min(subtotal, Math.round(Number(orderDiscount || 0))));
  const finalTotal = Math.max(0, subtotal - discountVal);

  const amountReceived =
    paymentMode === 'paid'
      ? finalTotal
      : paymentMode === 'unpaid'
      ? 0
      : Math.max(0, Math.min(finalTotal, Math.round(Number(partialAmount || 0))));

  const remainingBalance = Math.max(0, finalTotal - amountReceived);

  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (cart.length === 0) {
      showToast(
        lang === 'fa' ? 'لطفاً حداقل یک کالا به فاکتور فروش اضافه کنید.' : 'Please add at least one product.',
        'error'
      );
      return;
    }
    if (customerId === 'walk-in' && remainingBalance > 0) {
      showToast(
        lang === 'fa'
          ? 'فروش نسیه یا پرداخت ناقص نیازمند انتخاب مشتری است. لطفاً یک مشتری انتخاب یا تعریف کنید.'
          : 'Credit or partial payment requires selecting a customer account.',
        'error'
      );
      return;
    }

    setSubmitting(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId === 'walk-in' ? null : customerId,
          pricing_type: pricingType,
          order_date: todayStr,
          due_date: remainingBalance > 0 ? dueDate : todayStr,
          status: orderStatus,
          order_discount: discountVal,
          notes,
          initial_payment_amount: amountReceived,
          initial_payment_method: paymentMethod,
          initial_payment_reference: paymentRef,
          items: cart.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: 0,
          })),
        }),
      });

      const selectedCustObj = customers.find((c) => c.id === customerId);
      setSavedReceipt({
        id: res.id,
        order_number: res.order_number,
        order_date: todayStr,
        customer_name: selectedCustObj ? selectedCustObj.name : t.common.walkInCustomer,
        customer_phone: selectedCustObj?.phone || '—',
        pricing_type: pricingType,
        items: [...cart],
        subtotal,
        discount: discountVal,
        final_total: finalTotal,
        amount_received: amountReceived,
        remaining_balance: remainingBalance,
        payment_method: paymentMethod,
      });

      showToast(
        lang === 'fa'
          ? `فروش با شماره ${res.order_number} با موفقیت ثبت شد.`
          : `Sale ${res.order_number} saved successfully.`,
        'success'
      );

      // Clear cart & reload stock
      setCart([]);
      setOrderDiscount('0');
      setPartialAmount('');
      setPaymentRef('');
      setNotes('');
      loadCatalogAndCustomers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Fast Sales Grid: Left/Start Catalog + Right/End Active Sale Cart */}
      <div className="no-print grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Product Selection Panel (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lang === 'fa' ? 'ثبت سریع فروش و صدور فاکتور' : 'Fast Point-of-Sale & Invoicing'}
                </h1>
                <p className="text-xs text-slate-500">
                  {lang === 'fa'
                    ? 'کالا را جستجو یا انتخاب کنید تا به فاکتور اضافه شود'
                    : 'Click any product below to add it to the current sale'}
                </p>
              </div>

              {/* Retail vs Wholesale Pricing Switch */}
              <div className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs dark:border-slate-800 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => applyPricingMode('retail')}
                  className={`h-8 rounded-md px-3 font-semibold transition-colors ${
                    pricingType === 'retail'
                      ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'fa' ? 'قیمت خرده‌فروشی' : 'Retail Price'}
                </button>
                <button
                  type="button"
                  onClick={() => applyPricingMode('wholesale')}
                  className={`h-8 rounded-md px-3 font-semibold transition-colors ${
                    pricingType === 'wholesale'
                      ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'fa' ? 'قیمت عمده‌فروشی' : 'Wholesale Price'}
                </button>
              </div>
            </div>

            {/* Search & Category Filter */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    lang === 'fa' ? 'جستجوی نام کالا یا کد کالا (SKU)...' : 'Search product name or SKU...'
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 ps-9 pe-3 text-xs focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="all">{lang === 'fa' ? 'همه دسته‌بندی‌ها' : 'All Categories'}</option>
                {settings.productCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              {t.common.loading}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              {t.common.noRecords}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredProducts.map((p) => {
                const activePrice =
                  pricingType === 'wholesale' && p.wholesale_price > 0
                    ? p.wholesale_price
                    : p.sale_price;
                const inCart = cart.find((c) => c.product_id === p.id);
                const isLow = p.stock_quantity <= p.min_stock_threshold;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className={`flex h-full flex-col justify-between rounded-xl border p-4 text-start transition-all ${
                      inCart
                        ? 'border-blue-600 bg-blue-50/30 dark:border-blue-500 dark:bg-blue-950/20'
                        : 'border-slate-200 bg-white hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[11px] text-slate-400">{p.sku}</span>
                        <StatusBadge
                          label={`${formatNumber(p.stock_quantity, lang)} ${
                            t.units[p.unit as keyof typeof t.units] || p.unit
                          }`}
                          tone={p.stock_quantity <= 0 ? 'danger' : isLow ? 'warning' : 'neutral'}
                        />
                      </div>
                      <div className="mt-1.5 text-xs font-bold text-slate-900 dark:text-white">
                        {p.name}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                      <div>
                        <div className="text-[10px] text-slate-400">
                          {pricingType === 'wholesale'
                            ? lang === 'fa'
                              ? 'فی عمده:'
                              : 'Wholesale:'
                            : lang === 'fa'
                            ? 'فی تکی:'
                            : 'Retail:'}
                        </div>
                        <div className="font-mono text-xs font-bold text-blue-600 tabular-nums dark:text-blue-400">
                          {formatCurrency(activePrice, lang)}
                        </div>
                      </div>
                      {inCart ? (
                        <span className="inline-flex h-7 items-center rounded-md bg-blue-600 px-2.5 font-mono text-xs font-bold text-white">
                          {formatNumber(inCart.quantity, lang)} ×
                        </span>
                      ) : (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Plus className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Sale Checkout Panel (5 cols) */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleSaveSale}
            className="sticky top-20 space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'fa' ? 'اقلام فاکتور و تسویه حساب' : 'Current Sale & Settlement'}
                </h2>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  {lang === 'fa' ? 'پاک کردن سبد' : 'Clear All'}
                </button>
              )}
            </div>

            {/* Customer Selection */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'مشتری (اختیاری برای فروش نقدی):' : 'Customer:'}
                </label>
                <button
                  type="button"
                  onClick={() => setQuickActionModal('customer')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{t.common.addCustomer}</span>
                </button>
              </div>
              <select
                value={customerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="walk-in">{t.common.walkInCustomer}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({t.customerType[c.customer_type as keyof typeof t.customerType]})
                    {c.outstanding_balance > 0
                      ? ` — بدهی قبلی: ${formatCurrency(c.outstanding_balance, lang)}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items List */}
            <div className="max-h-64 space-y-2 overflow-y-auto border-y border-slate-200 py-3 dark:border-slate-800">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {lang === 'fa'
                    ? 'هنوز کالایی به فاکتور اضافه نشده است. روی کالاهای سمت راست کلیک کنید.'
                    : 'No items in sale yet. Click products on the left to add them.'}
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product_id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.product_id, 0)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      {/* Quantity Stepper */}
                      <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.product_id, item.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateCartQty(item.product_id, Number(e.target.value))}
                          className="h-7 w-12 border-x border-slate-200 bg-transparent text-center font-mono text-xs focus:outline-none dark:border-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.product_id, item.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Editable Unit Price (Toman) */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">
                          {lang === 'fa' ? 'فی:' : 'Price:'}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateCartPrice(item.product_id, Number(e.target.value))}
                          className="h-7 w-28 rounded border border-slate-300 bg-white px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>

                      {/* Line Total */}
                      <div className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatCurrency(item.unit_price * item.quantity, lang)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Discount & Payment Situation */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'تخفیف فاکتور (تومان)' : 'Discount (TOMAN)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'وضعیت سفارش' : 'Order Status'}
                  </label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as any)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="completed">{t.orderStatus.completed}</option>
                    <option value="registered">{t.orderStatus.registered}</option>
                    <option value="preparing">{t.orderStatus.preparing}</option>
                  </select>
                </div>
              </div>

              {/* Payment Status Selector */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'وضعیت پرداخت وجه' : 'Payment Situation'}
                </label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'paid', label: t.paymentStatus.paid },
                      { id: 'partially_paid', label: t.paymentStatus.partially_paid },
                      { id: 'unpaid', label: lang === 'fa' ? 'نسیه (پرداخت‌نشده)' : 'On Credit' },
                    ] as const
                  ).map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => {
                        if (customerId === 'walk-in' && pm.id !== 'paid') {
                          showToast(
                            lang === 'fa'
                              ? 'برای فروش نسیه یا پرداخت ناقص ابتدا مشتری را از لیست بالا انتخاب کنید.'
                              : 'Select a customer above to sell on credit.',
                            'info'
                          );
                          return;
                        }
                        setPaymentMode(pm.id);
                      }}
                      className={`h-10 rounded-lg border text-xs font-semibold transition-colors ${
                        paymentMode === pm.id
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === 'partially_paid' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'مبلغ دریافتی الان (تومان) *' : 'Amount Received Now (TOMAN) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={finalTotal}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder={lang === 'fa' ? 'مبلغ نقد یا کارت‌خوان...' : 'Enter received amount'}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              )}

              {paymentMode !== 'unpaid' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      {lang === 'fa' ? 'روش دریافت' : 'Payment Method'}
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
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
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              {remainingBalance > 0 && (
                <div>
                  <label className="block font-semibold text-amber-700 dark:text-amber-400">
                    {lang === 'fa' ? 'تاریخ سررسید تسویه بدهی' : 'Debt Due Date'}
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-amber-300 bg-amber-50/40 px-3 font-mono text-xs dark:border-amber-800 dark:bg-amber-950/20"
                  />
                </div>
              )}
            </div>

            {/* Live Financial Summary Box */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{lang === 'fa' ? 'جمع اقلام:' : 'Subtotal:'}</span>
                <span className="font-mono tabular-nums">{formatCurrency(subtotal, lang)}</span>
              </div>
              {discountVal > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{lang === 'fa' ? 'تخفیف:' : 'Discount:'}</span>
                  <span className="font-mono tabular-nums">-{formatCurrency(discountVal, lang)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                <span>{lang === 'fa' ? 'مبلغ نهایی فاکتور:' : 'Final Total:'}</span>
                <span className="font-mono tabular-nums">{formatCurrency(finalTotal, lang)}</span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                <span>{lang === 'fa' ? 'مبلغ دریافتی:' : 'Amount Received:'}</span>
                <span className="font-mono tabular-nums">{formatCurrency(amountReceived, lang)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-amber-600 dark:border-slate-700 dark:text-amber-400">
                <span>{lang === 'fa' ? 'مانده بدهی این فاکتور:' : 'Remaining Balance:'}</span>
                <span className="font-mono tabular-nums">{formatCurrency(remainingBalance, lang)}</span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              icon={CheckCircle2}
              disabled={submitting || cart.length === 0}
              className="w-full"
            >
              {lang === 'fa' ? 'ثبت نهایی فروش و صدور رسید' : 'Complete Sale & Generate Receipt'}
            </Button>
          </form>
        </div>
      </div>

      {/* Printable Receipt Modal After Saving Sale */}
      {savedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="print-container my-8 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="no-print mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-bold">
                  {lang === 'fa' ? 'فروش با موفقیت ثبت شد' : 'Sale Recorded Successfully'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSavedReceipt(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Printable Receipt Content */}
            <div className="space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-3 text-center dark:border-slate-800">
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'fa' ? settings.businessNameFa : settings.businessName}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{settings.phone}</div>
                <div className="mt-2 font-mono text-sm font-bold text-blue-600">
                  {savedReceipt.order_number}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                  {formatDate(savedReceipt.order_date, lang, settings.usePersianCalendar)}
                </div>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-slate-500">{lang === 'fa' ? 'خریدار:' : 'Customer:'}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {savedReceipt.customer_name}
                </span>
              </div>

              <table className="w-full border-y border-slate-200 py-2 text-xs dark:border-slate-800">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <th className="py-2 text-start">{lang === 'fa' ? 'کالا' : 'Item'}</th>
                    <th className="py-2 text-center">{lang === 'fa' ? 'تعداد' : 'Qty'}</th>
                    <th className="py-2 text-end">{lang === 'fa' ? 'فی' : 'Unit'}</th>
                    <th className="py-2 text-end">{lang === 'fa' ? 'جمع' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {savedReceipt.items.map((it: CartItem) => (
                    <tr key={it.product_id}>
                      <td className="py-2 font-medium">{it.name}</td>
                      <td className="py-2 text-center font-mono">{formatNumber(it.quantity, lang)}</td>
                      <td className="py-2 text-end font-mono">{formatNumber(it.unit_price, lang)}</td>
                      <td className="py-2 text-end font-mono font-semibold">
                        {formatCurrency(it.unit_price * it.quantity, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === 'fa' ? 'جمع اقلام:' : 'Subtotal:'}</span>
                  <span className="font-mono">{formatCurrency(savedReceipt.subtotal, lang)}</span>
                </div>
                {savedReceipt.discount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>{lang === 'fa' ? 'تخفیف:' : 'Discount:'}</span>
                    <span className="font-mono">-{formatCurrency(savedReceipt.discount, lang)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold dark:border-slate-800">
                  <span>{lang === 'fa' ? 'مبلغ قابل پرداخت:' : 'Final Total:'}</span>
                  <span className="font-mono">{formatCurrency(savedReceipt.final_total, lang)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>{lang === 'fa' ? 'مبلغ دریافت‌شده:' : 'Amount Paid:'}</span>
                  <span className="font-mono">{formatCurrency(savedReceipt.amount_received, lang)}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-600">
                  <span>{lang === 'fa' ? 'مانده بدهی:' : 'Remaining Debt:'}</span>
                  <span className="font-mono">{formatCurrency(savedReceipt.remaining_balance, lang)}</span>
                </div>
              </div>
            </div>

            <div className="no-print mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(`/orders/${savedReceipt.id}`)}>
                {t.common.viewDetails}
              </Button>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                {t.common.print}
              </Button>
              <Button variant="primary" onClick={() => setSavedReceipt(null)}>
                {lang === 'fa' ? 'ثبت فروش جدید' : 'New Sale'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
