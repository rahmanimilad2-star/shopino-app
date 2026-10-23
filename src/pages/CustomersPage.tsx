import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Search,
  Download,
  Edit2,
  Archive,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatDate, exportToCsv } from '../utils/format.ts';
import { Button, StatusBadge } from '../components/ui.tsx';

export const CustomersPage: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger }) => {
  const {
    lang,
    t,
    settings,
    includeDemo,
    navigate,
    apiFetch,
    showToast,
    setQuickActionModal,
    requestConfirm,
  } = useApp();

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [editingCust, setEditingCust] = useState<any | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/customers?includeDemo=${includeDemo}`);
      setCustomers(res.customers || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, includeDemo, showToast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers, refreshTrigger]);

  const filtered = customers.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (typeFilter !== 'all' && c.customer_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleExportCsv = () => {
    exportToCsv(
      'shopino-customers.csv',
      ['Code', 'Customer Name', 'Phone', 'Type', 'Total Purchases (TOMAN)', 'Total Payments (TOMAN)', 'Remaining Debt (TOMAN)'],
      filtered.map((c) => [
        c.code,
        c.name,
        c.phone || '',
        c.customer_type,
        c.total_purchases,
        c.total_payments,
        c.outstanding_balance,
      ])
    );
  };

  const handleToggleArchive = async (c: any) => {
    const nextStatus = c.status === 'active' ? 'archived' : 'active';
    try {
      await apiFetch(`/api/customers/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...c, status: nextStatus }),
      });
      showToast(
        lang === 'fa'
          ? `وضعیت مشتری به ${nextStatus === 'archived' ? 'بایگانی' : 'فعال'} تغییر یافت.`
          : `Customer marked as ${nextStatus}.`,
        'info'
      );
      loadCustomers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteCustomer = (c: any) => {
    requestConfirm({
      title: lang === 'fa' ? 'تأیید حذف مشتری' : 'Confirm Customer Deletion',
      message:
        lang === 'fa'
          ? `آیا از حذف «${c.name}» اطمینان دارید؟ (در صورتی که مشتری دارای فاکتور ثبت‌شده باشد، برای حفظ حساب‌ها قابل حذف نیست و می‌توانید او را بایگانی کنید).`
          : `Are you sure you want to delete "${c.name}"?`,
      confirmLabel: t.common.delete,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await apiFetch(`/api/customers/${c.id}`, { method: 'DELETE' });
          showToast(lang === 'fa' ? 'مشتری حذف شد.' : 'Customer deleted.', 'success');
          loadCustomers();
        } catch (err: any) {
          showToast(err.message, 'error');
        }
      },
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCust) return;
    try {
      await apiFetch(`/api/customers/${editingCust.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingCust),
      });
      showToast(lang === 'fa' ? 'اطلاعات مشتری ذخیره شد.' : 'Customer updated.', 'success');
      setEditingCust(null);
      loadCustomers();
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.nav.customers}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {lang === 'fa'
              ? 'فهرست مشتریان خرده‌فروشی و عمده‌فروشی، سوابق خرید، پرداخت‌ها و مانده بدهی به تومان'
              : 'Manage retail and wholesale customers, purchase history, and outstanding Toman debts.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" icon={Download} onClick={handleExportCsv}>
            {t.common.exportCsv}
          </Button>
          <Button variant="primary" icon={UserPlus} onClick={() => setQuickActionModal('customer')}>
            {t.common.addCustomer}
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'fa'
                ? 'جستجوی نام مشتری یا شماره تماس...'
                : 'Search customer name or phone number...'
            }
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 ps-9 pe-3 text-xs focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">{lang === 'fa' ? 'همه مشتریان (خرده و عمده)' : 'All Customer Types'}</option>
            <option value="retail">{t.customerType.retail}</option>
            <option value="wholesale">{t.customerType.wholesale}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="active">{lang === 'fa' ? 'مشتریان فعال' : 'Active Only'}</option>
            <option value="archived">{lang === 'fa' ? 'بایگانی‌شده' : 'Archived'}</option>
            <option value="all">{lang === 'fa' ? 'همه' : 'All'}</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
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
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'نام مشتری / فروشگاه' : 'Customer'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'تلفن و نوع خرید' : 'Phone & Type'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'fa' ? 'کل خرید' : 'Total Purchases'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'fa' ? 'کل پرداختی' : 'Total Payments'}</th>
                  <th className="px-4 py-3 text-end">{t.common.balance}</th>
                  <th className="px-4 py-3 text-start">{lang === 'fa' ? 'آخرین فعالیت' : 'Latest Activity'}</th>
                  <th className="px-4 py-3 text-end">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className="font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                      >
                        {c.name}
                      </button>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        <span className="font-mono">{c.code}</span>
                        {c.notes ? ` · ${c.notes}` : ''}
                        {c.is_demo ? ` · ${t.common.sampleRecord}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-700 dark:text-slate-300">
                        {c.phone || '—'}
                      </div>
                      <div className="mt-1">
                        <StatusBadge
                          label={
                            c.customer_type === 'wholesale'
                              ? t.customerType.wholesale
                              : t.customerType.retail
                          }
                          tone={c.customer_type === 'wholesale' ? 'info' : 'neutral'}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end font-mono font-medium tabular-nums">
                      {formatCurrency(c.total_purchases, lang)}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-emerald-600 tabular-nums dark:text-emerald-400">
                      {formatCurrency(c.total_payments, lang)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="inline-flex flex-col items-end gap-1">
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            c.outstanding_balance > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(c.outstanding_balance, lang)}
                        </span>
                        {c.outstanding_balance > 0 && (
                          <StatusBadge label={t.paymentStatus.debtor} tone="warning" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {formatDate(c.last_activity || c.created_at, lang, settings.usePersianCalendar)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/customers/${c.id}`)}
                          title={t.common.viewDetails}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCust({ ...c })}
                          title={t.common.edit}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(c)}
                          title={t.common.archive}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(c)}
                          title={t.common.delete}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Customer Modal */}
      {editingCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.common.edit}: {editingCust.name}
              </h3>
              <button onClick={() => setEditingCust(null)}>
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'نام مشتری یا فروشگاه *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editingCust.name}
                  onChange={(e) => setEditingCust({ ...editingCust, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'شماره تماس' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={editingCust.phone || ''}
                    onChange={(e) => setEditingCust({ ...editingCust, phone: e.target.value })}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'fa' ? 'نوع مشتری' : 'Customer Type'}
                  </label>
                  <select
                    value={editingCust.customer_type}
                    onChange={(e) =>
                      setEditingCust({ ...editingCust, customer_type: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="retail">{t.customerType.retail}</option>
                    <option value="wholesale">{t.customerType.wholesale}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fa' ? 'نشانی' : 'Address'}
                </label>
                <input
                  type="text"
                  value={editingCust.address || ''}
                  onChange={(e) => setEditingCust({ ...editingCust, address: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {t.common.notes}
                </label>
                <input
                  type="text"
                  value={editingCust.notes || ''}
                  onChange={(e) => setEditingCust({ ...editingCust, notes: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button variant="outline" onClick={() => setEditingCust(null)}>
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
    </div>
  );
};
