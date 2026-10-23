import React, { useState } from 'react';
import { Globe, Sun, Moon, Lock, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { Button, IconButton } from '../components/ui.tsx';

export const LoginPage: React.FC = () => {
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

  const [email, setEmail] = useState('admin@sellerhub.io');
  const [password, setPassword] = useState('SellerHub@2026');
  const [loading, setLoading] = useState(false);

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      loginWithToken(res.token, res.user);
      await refreshSession();
      navigate('/dashboard');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (role: string) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/demo-role', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      loginWithToken(res.token, res.user);
      await refreshSession();
      navigate('/dashboard');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const displayBrand = lang === 'fa' ? settings.businessNameFa || 'شاپینو' : settings.businessName || 'Shopino';

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => navigate('/landing')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"
        >
          <BackIcon className="h-4 w-4" />
          <span>{t.nav.landing}</span>
        </button>

        <div className="flex h-10 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'fa' : 'en')}
            className="m-0 inline-flex h-10 min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold leading-none text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Globe className="h-4 w-4 text-slate-500" />
            <span>{lang === 'en' ? 'فارسی' : 'EN'}</span>
          </button>
          <IconButton
            icon={theme === 'light' ? Moon : Sun}
            onClick={toggleTheme}
            aria-label="Toggle Theme"
          />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-mono text-sm font-bold text-white">
              {settings.logoText || 'SH'}
            </span>
            <h1 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
              {lang === 'fa' ? `ورود به پنل مدیریت ${displayBrand}` : `Sign in to ${displayBrand}`}
            </h1>
            <p className="mt-1 text-xs text-slate-500">{t.brandSubtitle}</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fa' ? 'ایمیل کاربری' : 'Email Address'}
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white ps-9 pe-3 font-mono text-xs focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fa' ? 'رمز عبور' : 'Password'}
              </label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white ps-9 pe-3 font-mono text-xs focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {lang === 'fa' ? 'ورود به داشبورد' : 'Sign In'}
            </Button>
          </form>

          {/* One-Click Demo Login */}
          <div className="mt-6 border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
            <div className="mb-2.5 text-center font-semibold text-slate-500">
              {lang === 'fa'
                ? 'ورود سریع به نسخه نمایشی (دمو):'
                : 'Quick One-Click Demo Access:'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickDemoLogin('owner')}
                disabled={loading}
              >
                {t.roles.owner}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickDemoLogin('sales')}
                disabled={loading}
              >
                {t.roles.sales}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
