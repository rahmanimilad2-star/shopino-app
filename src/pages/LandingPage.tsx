import React from 'react';
import {
  ShoppingBag,
  Users,
  Package,
  CreditCard,
  BarChart3,
  Globe,
  Sun,
  Moon,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatNumber } from '../utils/format.ts';
import { Button, IconButton, MetricCard, StatusBadge } from '../components/ui.tsx';

export const LandingPage: React.FC = () => {
  const {
    lang,
    setLang,
    dir,
    t,
    theme,
    toggleTheme,
    settings,
    navigate,
    apiFetch,
    loginWithToken,
    refreshSession,
    showToast,
  } = useApp();

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const handleLaunchLiveDemo = async () => {
    try {
      const res = await apiFetch('/api/auth/demo-role', {
        method: 'POST',
        body: JSON.stringify({ role: 'owner' }),
      });
      loginWithToken(res.token, res.user);
      await refreshSession();
      navigate('/dashboard');
    } catch (err: any) {
      showToast(err.message, 'error');
      navigate('/login');
    }
  };

  const displayBrand = lang === 'fa' ? settings.businessNameFa || 'شاپینو' : settings.businessName || 'Shopino';

  const features = [
    {
      icon: ShoppingBag,
      titleFa: 'ثبت سریع فروش نقدی و نسیه',
      titleEn: 'Fast Cash & Credit Sales',
      descFa: 'جستجوی سریع کالا، انتخاب قیمت خرده‌فروشی یا عمده‌فروشی، اعمال تخفیف و صدور فوری رسید چاپی.',
      descEn: 'Search products, switch between retail and wholesale pricing, apply discounts, and print receipts.',
    },
    {
      icon: CreditCard,
      titleFa: 'مدیریت دریافت‌ها و بدهی مشتریان',
      titleEn: 'Payments & Customer Debts',
      descFa: 'ثبت دریافت نقدی یا کارت‌خوان، مشاهده بدهی قبل و بعد از پرداخت و پیگیری فاکتورهای نسیه.',
      descEn: 'Record partial or full payments in Toman and see customer debt before and after each payment.',
    },
    {
      icon: Package,
      titleFa: 'کنترل ساده کالاها و موجودی انبار',
      titleEn: 'Simple Products & Stock Control',
      descFa: 'ثبت قیمت خرید، قیمت تکی و قیمت عمده به تومان همراه با هشدار خودکار کالاهای رو به اتمام.',
      descEn: 'Manage purchase cost, retail price, wholesale price, and low-stock alerts without complexity.',
    },
    {
      icon: Users,
      titleFa: 'پرونده مشتریان خرده‌فروشی و عمده',
      titleEn: 'Retail & Wholesale Customers',
      descFa: 'مشاهده کل خرید، کل پرداختی، مانده بدهی و آخرین تاریخ خرید هر مشتری در یک صفحه شفاف.',
      descEn: 'View total purchases, payments, remaining debt, and latest activity for every buyer.',
    },
    {
      icon: BarChart3,
      titleFa: 'گزارش فروش و سود تخمینی کالاها',
      titleEn: 'Clear Sales & Profit Reports',
      descFa: 'تفکیک شفاف کل فروش، پول دریافت‌شده واقعی، بدهی مشتریان و سود تخمینی کالاها با خروجی اکسل.',
      descEn: 'Clearly distinguish total sales, cash received, customer debts, and estimated product profit.',
    },
  ];

  return (
    <div dir={dir} className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Bar Contract: 3 Distinct Zones, Strictly Aligned 40px Controls */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Brand Logo & Name */}
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-mono text-xs font-bold text-white">
              {settings.logoText || 'SH'}
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {displayBrand}
            </span>
          </div>

          {/* Zone 2: Section Links */}
          <nav className="hidden items-center gap-6 text-xs font-semibold text-slate-600 md:flex dark:text-slate-300">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400">
              {lang === 'fa' ? 'امکانات کلیدی' : 'Features'}
            </a>
            <a href="#benefits" className="hover:text-blue-600 dark:hover:text-blue-400">
              {lang === 'fa' ? 'مزایا برای کسب‌وکارها' : 'Benefits'}
            </a>
            <a href="#contact" className="hover:text-blue-600 dark:hover:text-blue-400">
              {lang === 'fa' ? 'تماس و درخواست دمو' : 'Contact'}
            </a>
          </nav>

          {/* Zone 3: Strictly Aligned 40px Actions */}
          <div className="flex h-10 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'fa' : 'en')}
              className="m-0 inline-flex h-10 min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold leading-none text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Globe className="h-4 w-4 text-slate-500" />
              <span>{lang === 'en' ? 'فارسی' : 'EN'}</span>
            </button>

            <IconButton
              icon={theme === 'light' ? Moon : Sun}
              onClick={toggleTheme}
              aria-label="Toggle Theme"
            />

            <Button variant="outline" onClick={() => navigate('/login')}>
              {lang === 'fa' ? 'ورود به پنل' : 'Sign In'}
            </Button>

            <Button variant="primary" icon={ArrowIcon} onClick={handleLaunchLiveDemo}>
              {lang === 'fa' ? 'درخواست دمو (تست آنلاین)' : 'Try Live Demo'}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 pt-14 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white">
            {lang === 'fa'
              ? 'مدیریت ساده فروش، مشتریان، بدهی‌ها و انبار ویژه فروشگاه‌ها و عمده‌فروشان'
              : 'Simple Sales, Customer Debt & Inventory Management for Retailers & Wholesalers'}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
            {lang === 'fa'
              ? 'بدون نیاز به دانش حسابداری یا پیچیدگی‌های فنی؛ فروش نقدی و نسیه خود را به تومان ثبت کنید، مانده حساب مشتریان را لحظه‌ای ببینید و موجودی کالاها را مدیریت نمایید.'
              : 'Built for everyday shop owners and wholesalers. Record cash and credit sales in Toman, track customer balances, and manage stock without accounting complexity.'}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" icon={ArrowIcon} onClick={handleLaunchLiveDemo}>
              {lang === 'fa' ? 'ورود مستقیم به نسخه نمایشی (دمو)' : 'Launch Interactive Demo'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/login')}>
              {lang === 'fa' ? 'ورود به حساب کاربری' : 'Go to Login'}
            </Button>
          </div>
        </div>

        {/* Realistic Dashboard Preview Frame */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 text-xs dark:border-slate-800">
            <span className="font-bold text-slate-900 dark:text-white">
              {lang === 'fa'
                ? 'پیش‌نمایش زنده محیط داشبورد شاپینو (محاسبه به تومان)'
                : 'Live Preview: Shopino Operations Dashboard (TOMAN)'}
            </span>
            <StatusBadge
              label={lang === 'fa' ? 'آماده بهره‌برداری' : 'Live System Preview'}
              tone="info"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title={t.dashboard.todaySales}
              value={formatCurrency(9130000, lang)}
              subtitle={lang === 'fa' ? '۳ فاکتور ثبت‌شده امروز' : '3 orders today'}
              icon={ShoppingBag}
              tone="blue"
            />
            <MetricCard
              title={t.dashboard.todayReceived}
              value={formatCurrency(7780000, lang)}
              subtitle={lang === 'fa' ? 'نقد و کارت‌خوان' : 'Cash & POS'}
              icon={CreditCard}
              tone="emerald"
            />
            <MetricCard
              title={t.dashboard.customerDebts}
              value={formatCurrency(16360000, lang)}
              subtitle={lang === 'fa' ? 'مانده فاکتورهای نسیه' : 'Open credit balances'}
              icon={Users}
              tone="amber"
            />
            <MetricCard
              title={t.dashboard.lowStockItems}
              value={formatNumber(3, lang)}
              subtitle={lang === 'fa' ? 'کالا زیر حد مجاز' : 'Items running low'}
              icon={Package}
              tone="rose"
            />
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {lang === 'fa'
              ? 'امکانات طراحی‌شده برای کار روزانه فروشگاه'
              : 'Core Features for Everyday Shop Operations'}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div
                key={idx}
                className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'fa' ? f.titleFa : f.titleEn}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {lang === 'fa' ? f.descFa : f.descEn}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Benefits for Retailers & Wholesalers */}
      <section id="benefits" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {lang === 'fa' ? 'مناسب برای خرده‌فروشان و فروشگاه‌ها' : 'For Retail Shop Owners'}
            </h3>
            <ul className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  {lang === 'fa'
                    ? 'ثبت سریع فروش حضوری حتی بدون نیاز به تعریف حساب مشتری'
                    : 'Fast walk-in cash sales without requiring a customer account'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  {lang === 'fa'
                    ? 'نمایش تمام مبالغ به تومان با ارقام فارسی خوانا'
                    : 'All prices and totals formatted clearly in Toman'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  {lang === 'fa'
                    ? 'چاپ فوری رسید فروش برای تحویل به مشتری'
                    : 'Instant printable customer sales receipts'}
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {lang === 'fa' ? 'مناسب برای عمده‌فروشان و پخش‌کنندگان' : 'For Wholesalers & Distributors'}
            </h3>
            <ul className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  {lang === 'fa'
                    ? 'پشتیبانی هم‌زمان از قیمت خرده‌فروشی و قیمت عمده‌فروشی برای هر کالا'
                    : 'Built-in retail and wholesale price tiers for every product'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  {lang === 'fa'
                    ? 'مدیریت دقیق فروش‌های نسیه، بیعانه‌ها و مانده بدهی همکاران'
                    : 'Full tracking of credit sales, partial payments, and customer debts'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  {lang === 'fa'
                    ? 'گزارش تفکیکی فروش عمده در برابر تک‌فروشی و برآورد سود کالاها'
                    : 'Dedicated wholesale vs. retail sales and product margin reports'}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Contact & Demo CTA Footer */}
      <footer id="contact" className="border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{displayBrand}</div>
            <p className="mt-1">{t.brandSubtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Phone className="h-4 w-4 text-blue-600" />
              {settings.phone}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Mail className="h-4 w-4 text-blue-600" />
              {settings.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-blue-600" />
              {lang === 'fa' ? settings.addressFa : settings.addressEn}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
