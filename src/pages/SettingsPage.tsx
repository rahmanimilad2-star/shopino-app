import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Trash2, UserCheck, Database, Info, Send } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { Button } from '../components/ui.tsx';

export const SettingsPage: React.FC = () => {
  const {
    lang,
    setLang,
    t,
    theme,
    toggleTheme,
    user,
    allowDemoLogin,
    settings,
    refreshSession,
    apiFetch,
    showToast,
    requestConfirm,
  } = useApp();

  const canEditShopSettings = !user || ['owner', 'manager'].includes(user.role);
  const isOwner = !user || user.role === 'owner';

  const [form, setForm] = useState(settings);
  const [prodCatsStr, setProdCatsStr] = useState((settings.productCategories || []).join('، '));
  const [saving, setSaving] = useState(false);

  // User Profile & Password State
  const [profileName, setProfileName] = useState(user?.name_fa || user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setForm(settings);
    setProdCatsStr((settings.productCategories || []).join('، '));
  }, [settings]);

  useEffect(() => {
    if (user) {
      setProfileName(lang === 'fa' ? user.name_fa : user.name);
      setProfileEmail(user.email);
    }
  }, [user, lang]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        currency: 'TOMAN',
        productCategories: prodCatsStr
          .split(/[,،]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await refreshSession();
      showToast(
        lang === 'fa' ? 'تنظیمات فروشگاه با موفقیت ذخیره شد.' : 'Shop settings saved.',
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: profileName,
          name_fa: profileName,
          email: profileEmail,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      await refreshSession();
      setCurrentPassword('');
      setNewPassword('');
      showToast(
        lang === 'fa' ? 'مشخصات کاربری و رمز عبور به‌روزرسانی شد.' : 'Profile updated.',
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResetDemo = () => {
    requestConfirm({
      title: lang === 'fa' ? 'تأیید بازنشانی داده‌های نمونه' : 'Confirm Demo Data Reset',
      message:
        lang === 'fa'
          ? 'آیا از بازنشانی داده‌های نمونه به حالت اولیه اطمینان دارید؟ داده‌های واقعی شما حفظ خواهند شد.'
          : 'Reset sample demo records back to their initial state?',
      confirmLabel: t.common.confirm,
      variant: 'primary',
      onConfirm: async () => {
        try {
          await apiFetch('/api/settings/reset-demo', {
            method: 'POST',
            body: JSON.stringify({ confirm: true }),
          });
          showToast(
            lang === 'fa' ? 'داده‌های نمونه بازنشانی شدند.' : 'Sample data reset.',
            'success'
          );
        } catch (err: any) {
          showToast(err.message, 'error');
        }
      },
    });
  };

  const handlePurgeDemo = () => {
    requestConfirm({
      title: lang === 'fa' ? 'تأیید حذف داده‌های نمونه' : 'Confirm Purge of Demo Data',
      message:
        lang === 'fa'
          ? 'آیا می‌خواهید تمامی رکوردهای نمونه حذف شوند تا فروشگاه فقط با اطلاعات واقعی شما کار کند؟'
          : 'Remove all sample demo records for live shop use?',
      confirmLabel: t.common.delete,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await apiFetch('/api/settings/purge-demo', {
            method: 'POST',
            body: JSON.stringify({ confirm: true }),
          });
          showToast(
            lang === 'fa'
              ? 'داده‌های نمونه حذف شدند.'
              : 'Sample data purged.',
            'info'
          );
        } catch (err: any) {
          showToast(err.message, 'error');
        }
      },
    });
  };

  const inputClass = 'shopino-input mt-1 w-full px-3';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="shopino-glass-card rounded-xl p-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-[#F1F5F9]">{t.nav.settings}</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-[#94A3B8]">
          {lang === 'fa'
            ? 'تنظیمات نام و لوگوی فروشگاه، شماره تماس، واحد پول (تومان)، رهگیری موجودی انبار و حساب کاربری'
            : 'Configure shop name, logo, phone, Toman currency, inventory tracking, and user profile.'}
        </p>
      </div>

      {/* 1. Shop & Receipt Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="shopino-glass-card rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
            {lang === 'fa' ? 'مشخصات فروشگاه و رسید فروش' : 'Shop Identity & Receipt Preferences'}
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'نام فروشگاه (فارسی)' : 'Shop Name (Persian)'}
              </label>
              <input
                type="text"
                value={form.businessNameFa}
                onChange={(e) => setForm({ ...form, businessNameFa: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'نام فروشگاه (انگلیسی)' : 'Shop Name (English)'}
              </label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'نشان لوگو (۲ تا ۴ حرف)' : 'Logo Monogram'}
              </label>
              <input
                type="text"
                maxLength={4}
                value={form.logoText || 'SH'}
                onChange={(e) => setForm({ ...form, logoText: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'شماره تماس فروشگاه' : 'Shop Phone Number'}
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'نشانی فروشگاه (فارسی)' : 'Address (Persian)'}
              </label>
              <input
                type="text"
                value={form.addressFa}
                onChange={(e) => setForm({ ...form, addressFa: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'واحد پول رسمی سیستم' : 'System Currency'}
              </label>
              <input
                type="text"
                disabled
                value={lang === 'fa' ? 'تومان (TOMAN)' : 'TOMAN (تومان)'}
                className={`${inputClass} bg-slate-100 text-slate-500 dark:bg-[#0B1220]/50 dark:text-[#94A3B8]`}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200/80 pt-4 text-xs sm:grid-cols-3 dark:border-slate-800">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'نوع فروش پیش‌فرض' : 'Default Pricing Mode'}
              </label>
              <select
                value={form.defaultPricingType || 'retail'}
                onChange={(e) =>
                  setForm({ ...form, defaultPricingType: e.target.value as 'retail' | 'wholesale' })
                }
                className={inputClass}
              >
                <option value="retail">{t.customerType.retail}</option>
                <option value="wholesale">{t.customerType.wholesale}</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'پیشوند شماره رسید / فاکتور' : 'Receipt Number Prefix'}
              </label>
              <input
                type="text"
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'حداقل موجودی پیش‌فرض (هشدار کمبود)' : 'Default Low-Stock Warning'}
              </label>
              <input
                type="number"
                min="0"
                value={form.lowStockThresholdDefault}
                onChange={(e) =>
                  setForm({ ...form, lowStockThresholdDefault: Number(e.target.value) })
                }
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#F1F5F9]">
              {lang === 'fa'
                ? 'دسته‌بندی‌های کالاها (با کاما یا ویرگول جدا کنید)'
                : 'Product Categories (comma-separated)'}
            </label>
            <input
              type="text"
              value={prodCatsStr}
              onChange={(e) => setProdCatsStr(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Toggles: Inventory Tracking, Persian Calendar, Language, Theme */}
          <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-slate-200/80 pt-4 text-xs dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-700 dark:text-[#F1F5F9]">
              <input
                type="checkbox"
                checked={form.enableInventoryTracking !== false}
                onChange={(e) => setForm({ ...form, enableInventoryTracking: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 accent-[#20D6C2]"
              />
              <span>
                {lang === 'fa'
                  ? 'فعال‌سازی کسر و کنترل خودکار موجودی انبار هنگام فروش'
                  : 'Enable automatic inventory stock tracking on sales'}
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-700 dark:text-[#F1F5F9]">
              <input
                type="checkbox"
                checked={form.usePersianCalendar}
                onChange={(e) => setForm({ ...form, usePersianCalendar: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 accent-[#20D6C2]"
              />
              <span>
                {lang === 'fa'
                  ? 'نمایش تاریخ شمسی (جلالی)'
                  : 'Use Persian Solar (Jalali) calendar'}
              </span>
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setLang(lang === 'en' ? 'fa' : 'en')}
            >
              {lang === 'en' ? 'تغییر زبان به فارسی' : 'Switch to English'}
            </Button>

            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {theme === 'light'
                ? lang === 'fa'
                  ? 'پوسته تاریک'
                  : 'Dark Theme'
                : lang === 'fa'
                ? 'پوسته روشن'
                : 'Light Theme'}
            </Button>
          </div>

          {canEditShopSettings && (
            <div className="mt-5 flex justify-end">
              <Button type="submit" variant="primary" icon={Save} disabled={saving}>
                {t.common.save}
              </Button>
            </div>
          )}
        </div>
      </form>

      {/* 2. User Profile & Password */}
      <form
        onSubmit={handleSaveProfile}
        className="shopino-glass-card rounded-xl p-6"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
          <UserCheck className="h-4 w-4 text-[#0d9488] dark:text-[#20D6C2]" />
          <span>{lang === 'fa' ? 'حساب کاربری و تغییر رمز عبور' : 'User Profile & Password'}</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
              {lang === 'fa' ? 'نام و نام خانوادگی' : 'Full Name'}
            </label>
            <input
              type="text"
              required
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
              {lang === 'fa' ? 'ایمیل ورود' : 'Login Email'}
            </label>
            <input
              type="email"
              required
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
              {lang === 'fa' ? 'رمز عبور فعلی (برای تغییر رمز/ایمیل)' : 'Current Password'}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
              {lang === 'fa' ? 'رمز عبور جدید (حداقل ۸ کاراکتر)' : 'New Password (min 8 chars)'}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="submit" variant="primary" icon={Save} disabled={savingProfile}>
            {lang === 'fa' ? 'ذخیره مشخصات کاربری' : 'Update Profile'}
          </Button>
        </div>
      </form>

      {/* 3. Sample Data Controls (Owner only) */}
      {isOwner && (
        <div className="shopino-glass-card rounded-xl p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
            <Database className="h-4 w-4 text-[#0d9488] dark:text-[#20D6C2]" />
            <span>
              {lang === 'fa'
                ? 'مدیریت داده‌های نمونه (شروع کار واقعی فروشگاه)'
                : 'Sample Data Controls'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-[#94A3B8]">
            {lang === 'fa'
              ? 'اطلاعات نمونه آزمایشی با اطلاعات واقعی شما ترکیب نمی‌شوند. هر زمان مایل بودید می‌توانید داده‌های نمونه را پاک کنید تا سیستم فقط با فاکتورهای واقعی فروشگاه شما کار کند.'
              : 'Sample data is clearly separated from your real records. You can reset or purge sample data anytime.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {allowDemoLogin && (
              <Button variant="outline" icon={RotateCcw} onClick={handleResetDemo}>
                {t.common.resetDemoData}
              </Button>
            )}
            <Button variant="danger" icon={Trash2} onClick={handlePurgeDemo}>
              {lang === 'fa'
                ? 'حذف داده‌های نمونه (شروع کار واقعی)'
                : 'Purge All Sample Data'}
            </Button>
          </div>
        </div>
      )}

      {/* 4. About the App */}
      <div className="shopino-glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-[#F1F5F9]">
          <Info className="h-4 w-4 text-[#0d9488] dark:text-[#20D6C2]" />
          <span>{lang === 'fa' ? 'درباره برنامه (About the App)' : 'About the App'}</span>
        </div>

        <div className="mt-3 flex flex-col justify-between gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:flex-row sm:items-center dark:border-slate-800 dark:text-[#94A3B8]">
          <div>
            <div className="font-semibold text-slate-800 dark:text-[#F1F5F9]">
              {lang === 'fa'
                ? `${settings.businessNameFa || t.brandName} — ${t.brandSubtitle}`
                : `${settings.businessName || t.brandName} — ${t.brandSubtitle}`}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-[#94A3B8]">
              {lang === 'fa'
                ? 'نسخه ۱.۰ — طراحی‌شده ویژه مدیریت ساده فروش، مشتریان و موجودی کالا به تومان'
                : 'Version 1.0 — Built for retail & wholesale sales, customer balances, and inventory in Toman'}
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 border-t border-slate-100 pt-3 sm:items-end sm:border-t-0 sm:pt-0 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-600 dark:text-[#F1F5F9]">
              Developed by M. R
            </span>
            <a
              href="https://t.me/rahmani208"
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-500 transition-colors hover:text-[#0d9488] dark:text-[#94A3B8] dark:hover:text-[#20D6C2]"
            >
              <Send className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} />
              <span>@rahmani208</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
