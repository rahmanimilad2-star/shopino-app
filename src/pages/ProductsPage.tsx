import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Download,
  Edit2,
  Archive,
  SlidersHorizontal,
  History,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatNumber, formatDate, exportToCsv } from '../utils/format.ts';
import { Button, StatusBadge } from '../components/ui.tsx';

export const ProductsPage: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger }) => {
  const {
    lang,
    t,
    settings,
    includeDemo,
    apiFetch,
    showToast,
    setQuickActionModal,
  } = useApp();

  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Modals: Edit Product, Quick Stock Adjustment, and Stock Movements History
  const [editingPrd, setEditingPrd] = useState<any | null>(null);
  const [adjustingPrd, setAdjustingPrd] = useState<any | null>(null);
  const [adjustType, setAdjustType] = useState<'addition' | 'reduction'>('addition');
  const [adjustQty, setAdjustQty] = useState('5');
  const [adjustReason, setAdjustReason] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/products?includeDemo=${includeDemo}`);
      setProducts(res.products || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, includeDemo, showToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts, refreshTrigger]);

  const openMovementsHistory = async () => {
    setHistoryOpen(true);
    try {
      const res = await apiFetch(`/api/inventory/movements?includeDemo=${includeDemo}`);
      setMovements(res.movements || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filtered = products.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (stockFilter === 'low' && p.stock_quantity > p.min_stock_threshold) return false;
    if (stockFilter === 'out' && p.stock_quantity > 0) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    }
    return true;
  });

  const handleExportCsv = () => {
    exportToCsv(
      'shopino-products.csv',
      ['Code', 'Product Name', 'Category', 'Unit', 'Purchase Cost (TOMAN)', 'Retail Price (TOMAN)', 'Wholesale Price (TOMAN)', 'Stock', 'Min Stock'],
      filtered.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.unit,
        p.cost_price,
        p.sale_price,
        p.wholesale_price,
        p.stock_quantity,
        p.min_stock_threshold,
      ])
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrd) return;
    try {
      await apiFetch(`/api/products/${editingPrd.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingPrd),
      });
      showToast(lang === 'fa' ? 'مشخصات کالا ویرایش شد.' : 'Product updated.', 'success');
      setEditingPrd(null);
      loadProducts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleArchive = async (p: any) => {
    const nextStatus = p.status === 'active' ? 'archived' : 'active';
    try {
      await apiFetch(`/api/products/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...p, status: nextStatus }),
      });
      showToast(
        lang === 'fa'
          ? `کالا به حالت ${nextStatus === 'archived' ? 'غیرفعال / بایگانی' : 'فعال'} تغییر یافت.`
          : `Product marked as ${nextStatus}.`,
        'info'
      );
      loadProducts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleQuickAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingPrd) return;
    const rawQty = Math.abs(Math.round(Number(adjustQty || 0)));
    if (rawQty <= 0) return;

    const delta = adjustType === 'addition' ? rawQty : -rawQty;
    try {
      await apiFetch('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          product_id: adjustingPrd.id,
          movement_type: adjustType,
          quantity_change: delta,
          reason:
            adjustReason ||
            (adjustType === 'addition' ? 'افزایش دستی موجودی انبار' : 'کاهش دستی موجودی انبار'),
        }),
      });
      showToast(
        lang === 'fa' ? 'موجودی انبار با موفقیت به‌روزرسانی شد.' : 'Stock quantity adjusted.',
        'success'
      );
      setAdjustingPrd(null);
      setAdjustReason('');
      loadProducts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const inputClass =
    'mt-1 h-10 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.nav.products}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {lang === 'fa'
              ? 'مدیریت کالاها، قیمت خرده‌فروشی و عمده‌فروشی (تومان) و کنترل موجودی انبار'
              : 'Manage products, retail & wholesale Toman prices, and stock levels.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" icon={History} onClick={openMovementsHistory}>
            {lang === 'fa' ? 'تاریخچه ورود و خروج کالا' : 'Stock History'}
          </Button>
          <Button variant="outline" icon={Download} onClick={handleExportCsv}>
            {t.common.exportCsv}
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setQuickActionModal('product')}>
            {t.common.addProduct}
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'fa' ? 'جستجوی نام کالا یا کد کالا...' : 'Search product name or code...'
            }
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 ps-9 pe-3 text-xs focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">{lang === 'fa' ? 'همه دسته‌بندی‌ها' : 'All Categories'}</option>
            {settings.productCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">{lang === 'fa' ? 'همه وضعیت‌های موجودی' : 'All Stock Levels'}</option>
            <option value="low">{lang === 'fa' ? 'کالاهای کم‌موجود' : 'Low Stock Only'}</option>
            <option value="out">{lang === 'fa' ? 'کالاهای ناموجود (صفر)' : 'Out of Stock'}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="active">{lang === 'fa' ? 'کالاهای فعال' : 'Active Products'}</option>
            <option value="archived">{lang === 'fa' ? 'غیرفعال / بایگانی' : 'Archived'}</option>
            <option value="all">{lang === 'fa' ? 'همه کالاها' : 'All'}</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
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
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'کد کالا' : 'Code'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'نام کالا و دسته‌بندی' : 'Product'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'fa' ? 'قیمت خرید' : 'Purchase Cost'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'fa' ? 'قیمت خرده‌فروشی' : 'Retail Price'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'fa' ? 'قیمت عمده‌فروشی' : 'Wholesale Price'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'fa' ? 'موجودی انبار' : 'Stock'}</th>
                  <th className="px-4 py-3 text-end">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((p) => {
                  const isLow = p.stock_quantity <= p.min_stock_threshold;
                  const unitLabel = t.units[p.unit as keyof typeof t.units] || p.unit;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-slate-500">
                        <div>{p.sku}</div>
                        {p.is_demo ? (
                          <span className="text-[10px] text-slate-400">{t.common.sampleRecord}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {p.category} · {unitLabel}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end font-mono text-slate-500 tabular-nums">
                        {p.cost_price > 0 ? formatCurrency(p.cost_price, lang) : '—'}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatCurrency(p.sale_price, lang)}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-semibold text-blue-600 tabular-nums dark:text-blue-400">
                        {p.wholesale_price > 0 ? formatCurrency(p.wholesale_price, lang) : '—'}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="inline-flex flex-col items-end gap-1">
                          <StatusBadge
                            label={`${formatNumber(p.stock_quantity, lang)} ${unitLabel}`}
                            tone={p.stock_quantity <= 0 ? 'danger' : isLow ? 'warning' : 'success'}
                          />
                          {isLow && (
                            <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                              {lang === 'fa' ? 'کمبود موجودی' : 'Low Stock'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustingPrd(p);
                              setAdjustType('addition');
                              setAdjustQty('5');
                            }}
                            title={lang === 'fa' ? 'تغییر سریع موجودی' : 'Quick Stock Adjust'}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPrd({ ...p })}
                            title={t.common.edit}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(p)}
                            title={t.common.archive}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Stock Adjustment Modal */}
      {adjustingPrd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'fa' ? 'تغییر سریع موجودی کالا' : 'Quick Stock Adjustment'}
              </h3>
              <button onClick={() => setAdjustingPrd(null)}>
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleQuickAdjustStock} className="mt-4 space-y-4 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="font-bold text-slate-900 dark:text-white">{adjustingPrd.name}</div>
                <div className="mt-1 text-slate-500">
                  {lang === 'fa' ? 'موجودی فعلی:' : 'Current Stock:'}{' '}
                  <span className="font-mono font-bold text-blue-600">
                    {formatNumber(adjustingPrd.stock_quantity, lang)}{' '}
                    {t.units[adjustingPrd.unit as keyof typeof t.units] || adjustingPrd.unit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('addition')}
                  className={`h-10 rounded-lg border font-semibold ${
                    adjustType === 'addition'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {lang === 'fa' ? '+ افزایش موجودی (ورود)' : '+ Add Stock'}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('reduction')}
                  className={`h-10 rounded-lg border font-semibold ${
                    adjustType === 'reduction'
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {lang === 'fa' ? '- کاهش موجودی (خروج)' : '- Reduce Stock'}
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'تعداد تغییر *' : 'Quantity *'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'علت تغییر موجودی (اختیاری)' : 'Reason / Note (Optional)'}
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={lang === 'fa' ? 'مثلاً: خرید بار جدید یا شمارش انبار' : 'e.g. New stock arrival'}
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAdjustingPrd(null)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" variant="primary">
                  {t.common.save}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingPrd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.common.edit}: {editingPrd.name}
              </h3>
              <button onClick={() => setEditingPrd(null)}>
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'نام کالا *' : 'Product Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editingPrd.name}
                  onChange={(e) => setEditingPrd({ ...editingPrd, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'کد کالا' : 'Code'}
                  </label>
                  <input
                    type="text"
                    value={editingPrd.sku}
                    onChange={(e) => setEditingPrd({ ...editingPrd, sku: e.target.value })}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'دسته‌بندی' : 'Category'}
                  </label>
                  <select
                    value={editingPrd.category}
                    onChange={(e) => setEditingPrd({ ...editingPrd, category: e.target.value })}
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
                    {lang === 'fa' ? 'واحد' : 'Unit'}
                  </label>
                  <select
                    value={editingPrd.unit || 'piece'}
                    onChange={(e) => setEditingPrd({ ...editingPrd, unit: e.target.value })}
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'قیمت خرید (تومان)' : 'Purchase Cost'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingPrd.cost_price}
                    onChange={(e) => setEditingPrd({ ...editingPrd, cost_price: Number(e.target.value) })}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'قیمت خرده‌فروشی *' : 'Retail Price *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingPrd.sale_price}
                    onChange={(e) => setEditingPrd({ ...editingPrd, sale_price: Number(e.target.value) })}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'قیمت عمده‌فروشی' : 'Wholesale Price'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingPrd.wholesale_price}
                    onChange={(e) =>
                      setEditingPrd({ ...editingPrd, wholesale_price: Number(e.target.value) })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'حداقل موجودی هشدار' : 'Low-Stock Threshold'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingPrd.min_stock_threshold}
                    onChange={(e) =>
                      setEditingPrd({ ...editingPrd, min_stock_threshold: Number(e.target.value) })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {t.common.notes}
                  </label>
                  <input
                    type="text"
                    value={editingPrd.notes || ''}
                    onChange={(e) => setEditingPrd({ ...editingPrd, notes: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button variant="outline" onClick={() => setEditingPrd(null)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" variant="primary">
                  {t.common.save}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movements History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'fa' ? 'تاریخچه تغییرات موجودی کالاها' : 'Recent Stock Movements'}
              </h3>
              <button onClick={() => setHistoryOpen(false)}>
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-start">{t.common.date}</th>
                    <th className="px-3 py-2 text-start">{lang === 'fa' ? 'کالا' : 'Product'}</th>
                    <th className="px-3 py-2 text-end">{lang === 'fa' ? 'تغییر' : 'Change'}</th>
                    <th className="px-3 py-2 text-end">{lang === 'fa' ? 'موجودی جدید' : 'New Stock'}</th>
                    <th className="px-3 py-2 text-start">{lang === 'fa' ? 'توضیح' : 'Reason'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2.5 font-mono text-slate-500">
                        {formatDate(m.created_at, lang, settings.usePersianCalendar)}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{m.product_name}</td>
                      <td
                        className={`px-3 py-2.5 text-end font-mono font-bold ${
                          m.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {m.quantity_change > 0 ? '+' : ''}
                        {formatNumber(m.quantity_change, lang)}
                      </td>
                      <td className="px-3 py-2.5 text-end font-mono">
                        {formatNumber(m.new_stock, lang)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
