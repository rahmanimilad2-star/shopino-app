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
    allowDemoLogin,
    settings,
    navigate,
    apiFetch,
    loginWithToken,
    refreshSession,
    showToast,
  } = useApp();

  const [email, setEmail] = useState(() => (allowDemoLogin ? 'admin@sellerhub.io' : ''));
  const [password, setPassword] = useState(() => (allowDemoLogin ? 'SellerHub@2026' : ''));
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (allowDemoLogin && !email && !password) {
      setEmail('admin@sellerhub.io');
      setPassword('SellerHub@2026');
    } else if (!allowDemoLogin && email === 'admin@sellerhub.io' && password === 'SellerHub@2026') {
      setEmail('');
      setPassword('');
    }
  }, [allowDemoLogin]);

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
    <div dir={dir} className="shopino-app-bg flex min-h-screen flex-col">
      <div className="shopino-ambient-orb" aria-hidden="true" />
      <div className="shopino-grid-overlay" aria-hidden="true" />

      {/* Header */}
      <header className="shopino-glass-header relative z-10 flex h-16 items-center justify-between px-4 sm:px-6">
        <button
          onClick={() => navigate('/landing')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F1F5F9]"
        >
          <BackIcon className="h-4 w-4" />
          <span>{t.nav.landing}</span>
        </button>

        <div className="flex h-10 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'fa' : 'en')}
            className="m-0 inline-flex h-10 min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200/90 bg-white/90 px-3 text-xs font-semibold leading-none text-slate-700 transition-all hover:border-[#20D6C2]/40 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-[#111C30]/85 dark:text-[#F1F5F9] dark:hover:border-[#20D6C2]/40 dark:hover:bg-[#16233B]"
          >
            <Globe className="h-4 w-4 text-slate-500 dark:text-[#20D6C2]" />
            <span>{lang === 'en' ? 'فارسی' : 'EN'}</span>
          </button>
          <IconButton
            icon={theme === 'light' ? Moon : Sun}
            onClick={toggleTheme}
            aria-label="Toggle Theme"
          />
        </div>
      </header>

      <div className="shopino-page-enter relative z-10 flex flex-1 items-center justify-center p-4">
        <div className="shopino-glass-modal w-full max-w-md rounded-2xl p-6 sm:p-8">
          <div className="text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#20D6C2]/40 bg-gradient-to-br from-[#20D6C2] to-[#7C83FF] font-mono text-sm font-extrabold text-[#041417] shadow-[0_0_20px_-4px_rgba(32,214,194,0.55)]">
              {settings.logoText || 'SH'}
            </span>
            <h1 className="mt-3 text-xl font-bold text-slate-900 dark:text-[#F1F5F9]">
              {lang === 'fa' ? `ورود به پنل مدیریت ${displayBrand}` : `Sign in to ${displayBrand}`}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#94A3B8]">{t.brandSubtitle}</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'ایمیل کاربری' : 'Email Address'}
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-slate-400 dark:text-[#94A3B8]" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="shopino-input w-full ps-9 pe-3 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-[#F1F5F9]">
                {lang === 'fa' ? 'رمز عبور' : 'Password'}
              </label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-slate-400 dark:text-[#94A3B8]" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="shopino-input w-full ps-9 pe-3 font-mono"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {lang === 'fa' ? 'ورود به داشبورد' : 'Sign In'}
            </Button>
          </form>

          {/* One-Click Demo Login (only shown when allowDemoLogin is enabled) */}
          {allowDemoLogin && (
            <div className="mt-6 border-t border-slate-200/80 pt-4 text-xs dark:border-slate-800">
              <div className="mb-2.5 text-center font-semibold text-slate-500 dark:text-[#94A3B8]">
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
          )}
        </div>
      </div>
    </div>
  );
};
