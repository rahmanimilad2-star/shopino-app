import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  ShoppingCart,
  Users,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  Bell,
  Menu,
  X,
  Search,
  Sun,
  Moon,
  Globe,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink,
  ChevronDown,
  Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/format.ts';
import { IconButton, Button } from './ui.tsx';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    lang,
    setLang,
    dir,
    t,
    theme,
    toggleTheme,
    user,
    allowDemoLogin,
    settings,
    unreadCount,
    refreshSession,
    loginWithToken,
    logout,
    currentPath,
    navigate,
    apiFetch,
    showToast,
    toasts,
    dismissToast,
    confirmDialog,
    closeConfirm,
  } = useApp();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    customers: any[];
    orders: any[];
    products: any[];
  } | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((res) => setSearchResults(res))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, apiFetch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchResults(null);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openNotificationsDropdown = async () => {
    setNotifOpen((prev) => !prev);
    setProfileOpen(false);
    try {
      const data = await apiFetch('/api/notifications');
      setRecentNotifs((data.notifications || []).slice(0, 6));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
      await refreshSession();
      const data = await apiFetch('/api/notifications');
      setRecentNotifs((data.notifications || []).slice(0, 6));
    } catch {
      // ignore
    }
  };

  const handleSwitchDemoRole = async (role: string) => {
    try {
      const data = await apiFetch('/api/auth/demo-role', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      loginWithToken(data.token, data.user);
      setProfileOpen(false);
      showToast(
        lang === 'fa'
          ? `نقش کاربری فعال به «${t.roles[role as keyof typeof t.roles]}» تغییر یافت.`
          : `Switched active role to ${t.roles[role as keyof typeof t.roles]}`,
        'info'
      );
      await refreshSession();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Strictly the 8 primary navigation items required for Shopino, filtered by role permissions
  const currentRole = user?.role || 'owner';
  const allNavItems = [
    { path: '/dashboard', label: t.nav.dashboard, icon: LayoutDashboard, roles: ['owner', 'manager', 'sales', 'accountant', 'inventory'] },
    { path: '/sales', label: t.nav.sales, icon: ShoppingBag, roles: ['owner', 'manager', 'sales'] },
    { path: '/orders', label: t.nav.orders, icon: ShoppingCart, roles: ['owner', 'manager', 'sales', 'accountant', 'inventory'] },
    { path: '/customers', label: t.nav.customers, icon: Users, roles: ['owner', 'manager', 'sales', 'accountant'] },
    { path: '/products', label: t.nav.products, icon: Package, roles: ['owner', 'manager', 'sales', 'accountant', 'inventory'] },
    { path: '/payments', label: t.nav.payments, icon: CreditCard, roles: ['owner', 'manager', 'sales', 'accountant'] },
    { path: '/reports', label: t.nav.reports, icon: BarChart3, roles: ['owner', 'manager', 'accountant'] },
    { path: '/settings', label: t.nav.settings, icon: Settings, roles: ['owner', 'manager', 'sales', 'accountant', 'inventory'] },
  ];
  const navItems = allNavItems.filter((item) => item.roles.includes(currentRole));

  const getBreadcrumbLabel = () => {
    if (currentPath.startsWith('/customers/')) {
      return `${t.nav.customers} / ${lang === 'fa' ? 'پرونده مشتری' : 'Customer Profile'}`;
    }
    if (currentPath.startsWith('/orders/')) {
      return `${t.nav.orders} / ${lang === 'fa' ? 'جزئیات سفارش و رسید' : 'Order & Receipt'}`;
    }
    const found = navItems.find((i) => currentPath === i.path);
    return found ? found.label : t.nav.dashboard;
  };

  const displayBrand =
    lang === 'fa'
      ? settings.businessNameFa || t.brandName
      : settings.businessName || t.brandName;

  const CollapseIcon =
    dir === 'rtl'
      ? sidebarCollapsed
        ? ChevronLeft
        : ChevronRight
      : sidebarCollapsed
      ? ChevronRight
      : ChevronLeft;

  return (
    <div dir={dir} className="shopino-app-bg min-h-screen">
      {/* Subtle Ambient Glow & Grid Overlay */}
      <div className="shopino-ambient-orb" aria-hidden="true" />
      <div className="shopino-grid-overlay" aria-hidden="true" />

      {/* Toast Notifications */}
      <div className="no-print fixed bottom-5 end-5 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl backdrop-blur-md transition-all ${
              toast.type === 'error'
                ? 'border-red-500/40 bg-red-950/90 text-red-100'
                : toast.type === 'success'
                ? 'border-[#20D6C2]/40 bg-[#111C30]/95 text-[#20D6C2]'
                : 'border-slate-700/80 bg-[#111C30]/95 text-[#F1F5F9]'
            }`}
          >
            <span>{toast.text}</span>
            <button onClick={() => dismissToast(toast.id)} className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="no-print fixed inset-0 z-40 bg-[#050912]/70 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`shopino-glass-sidebar no-print fixed top-0 bottom-0 z-40 flex flex-col transition-transform duration-200 ${
          sidebarCollapsed ? 'w-18' : 'w-60'
        } ${
          mobileMenuOpen
            ? 'translate-x-0'
            : dir === 'rtl'
            ? 'translate-x-full lg:translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header (Matches 64px Header Height) */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/80">
          {!sidebarCollapsed && (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2.5 truncate text-start text-base font-bold tracking-tight text-slate-900 dark:text-[#F1F5F9]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#20D6C2]/40 bg-gradient-to-br from-[#20D6C2] to-[#7C83FF] font-mono text-xs font-extrabold text-[#041417] shadow-[0_0_16px_-3px_rgba(32,214,194,0.5)]">
                {settings.logoText || 'SH'}
              </span>
              <span className="truncate">{displayBrand}</span>
            </button>
          )}
          {sidebarCollapsed && (
            <button
              onClick={() => navigate('/dashboard')}
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-[#20D6C2]/40 bg-gradient-to-br from-[#20D6C2] to-[#7C83FF] font-mono text-xs font-extrabold text-[#041417] shadow-[0_0_16px_-3px_rgba(32,214,194,0.5)]"
            >
              {settings.logoText || 'SH'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 lg:inline-flex dark:text-[#94A3B8] dark:hover:bg-[#16233B] dark:hover:text-[#F1F5F9]"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <CollapseIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 lg:hidden dark:text-[#94A3B8]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Primary 8 Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.path ||
              (item.path !== '/dashboard' && currentPath.startsWith(`${item.path}/`));
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                title={sidebarCollapsed ? item.label : undefined}
                className={`group relative flex h-10 w-full items-center justify-between rounded-lg px-3 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'border border-[#20D6C2]/35 bg-[#20D6C2]/14 text-[#0d9488] shadow-[0_0_20px_-6px_rgba(32,214,194,0.38)] dark:border-[#20D6C2]/35 dark:bg-[#20D6C2]/15 dark:text-[#20D6C2]'
                    : 'border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:bg-[#16233B]/75 dark:hover:text-[#F1F5F9]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center transition-colors ${
                      isActive
                        ? 'text-[#0d9488] dark:text-[#20D6C2]'
                        : 'text-slate-400 group-hover:text-slate-700 dark:text-[#94A3B8] dark:group-hover:text-[#F1F5F9]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.95} />
                  </span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {isActive && !sidebarCollapsed && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#20D6C2] shadow-[0_0_8px_#20D6C2]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Public Presentation Link & Discreet Developer Attribution */}
        <div className="border-t border-slate-200/80 p-3 dark:border-slate-800/80">
          <button
            onClick={() => navigate('/landing')}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:bg-[#16233B]/75 dark:hover:text-[#F1F5F9]"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <ExternalLink className="h-4 w-4 shrink-0" />
            </span>
            {!sidebarCollapsed && <span className="truncate">{t.nav.landing}</span>}
          </button>

          <div className="mt-2 border-t border-slate-200/70 pt-2.5 dark:border-slate-800/70">
            {!sidebarCollapsed ? (
              <div className="px-3 text-start text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                <div className="truncate font-medium">Developed by M. R</div>
                <a
                  href="https://t.me/rahmani208"
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400 transition-colors hover:text-[#0d9488] dark:text-slate-500 dark:hover:text-[#20D6C2]"
                >
                  <Send className="h-3 w-3 shrink-0" strokeWidth={1.85} />
                  <span>@rahmani208</span>
                </a>
              </div>
            ) : (
              <div className="flex justify-center">
                <a
                  href="https://t.me/rahmani208"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Developed by M. R — @rahmani208"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0d9488] dark:text-slate-500 dark:hover:bg-[#16233B] dark:hover:text-[#20D6C2]"
                >
                  <Send className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} />
                </a>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`relative z-10 flex min-h-screen flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'lg:ps-18' : 'lg:ps-60'
        }`}
      >
        {/* Top Header - Strict Pixel-Aligned 64px Bar */}
        <header className="shopino-glass-header no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          {/* Zone 1 (Start): Mobile Menu IconButton + Page Title / Breadcrumb */}
          <div className="flex h-10 min-w-0 items-center gap-2.5">
            <div className="lg:hidden">
              <IconButton
                icon={Menu}
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open Navigation"
              />
            </div>
            <div className="flex h-10 items-center gap-2 truncate text-sm leading-none">
              <span className="hidden font-medium text-slate-400 sm:inline dark:text-[#94A3B8]">
                {displayBrand}
              </span>
              <span className="hidden text-slate-300 sm:inline dark:text-slate-700" aria-hidden="true">
                /
              </span>
              <span className="truncate font-bold text-slate-900 dark:text-[#F1F5F9]">
                {getBreadcrumbLabel()}
              </span>
            </div>
          </div>

          {/* Zone 2 (Center): Global Search Input (Exact h-10 / 40px height) */}
          <div ref={searchRef} className="relative hidden max-w-md flex-1 md:block">
            <div className="relative flex h-10 items-center">
              <span className="pointer-events-none absolute start-3 flex h-5 w-5 items-center justify-center text-slate-400 dark:text-[#94A3B8]">
                <Search className="h-4 w-4 shrink-0" strokeWidth={1.85} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.common.searchPlaceholder}
                className="shopino-input m-0 w-full ps-9 pe-3 leading-none"
              />
            </div>

            {searchResults && (
              <div className="shopino-glass-modal absolute top-12 right-0 left-0 z-50 max-h-96 overflow-y-auto rounded-xl p-3">
                {searchResults.customers.length === 0 &&
                searchResults.orders.length === 0 &&
                searchResults.products.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
                    {t.common.noRecords}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {searchResults.products.length > 0 && (
                      <div>
                        <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 dark:text-[#94A3B8]">
                          {t.nav.products}
                        </div>
                        {searchResults.products.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSearchResults(null);
                              setSearchQuery('');
                              navigate('/products');
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-start text-xs transition-colors hover:bg-slate-100 dark:hover:bg-[#16233B]"
                          >
                            <span className="font-medium text-slate-900 dark:text-[#F1F5F9]">
                              {p.name}
                            </span>
                            <span className="font-mono text-slate-500 dark:text-[#20D6C2]">
                              {formatCurrency(p.sale_price, lang)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.customers.length > 0 && (
                      <div>
                        <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 dark:text-[#94A3B8]">
                          {t.nav.customers}
                        </div>
                        {searchResults.customers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSearchResults(null);
                              setSearchQuery('');
                              navigate(`/customers/${c.id}`);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-start text-xs transition-colors hover:bg-slate-100 dark:hover:bg-[#16233B]"
                          >
                            <span className="font-medium text-slate-900 dark:text-[#F1F5F9]">
                              {c.name}
                            </span>
                            <span className="font-mono text-slate-500 dark:text-[#94A3B8]">
                              {c.phone || c.code}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.orders.length > 0 && (
                      <div>
                        <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 dark:text-[#94A3B8]">
                          {t.nav.orders}
                        </div>
                        {searchResults.orders.map((o) => (
                          <button
                            key={o.id}
                            onClick={() => {
                              setSearchResults(null);
                              setSearchQuery('');
                              navigate(`/orders/${o.id}`);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-start text-xs transition-colors hover:bg-slate-100 dark:hover:bg-[#16233B]"
                          >
                            <span className="font-mono font-semibold text-[#0d9488] dark:text-[#20D6C2]">
                              {o.order_number}
                            </span>
                            <span className="text-slate-600 dark:text-[#94A3B8]">
                              {o.customer_name} · {formatCurrency(o.final_total, lang)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zone 3 (End): Strictly Aligned 40px Controls (Gap 10px / gap-2.5) */}
          <div className="flex h-10 shrink-0 items-center gap-2.5">
            {/* Fast Sale Shortcut Button (40px height) - only for roles permitted to create orders */}
            {['owner', 'manager', 'sales'].includes(currentRole) && (
              <div className="hidden sm:block">
                <Button variant="primary" icon={Plus} onClick={() => navigate('/sales')}>
                  {t.common.createOrder}
                </Button>
              </div>
            )}

            {/* Language Switcher Control (Exact 40px height, 20x20px icon wrapper) */}
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'fa' : 'en')}
              className="m-0 inline-flex h-10 min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200/90 bg-white/90 px-3 text-xs font-semibold leading-none text-slate-700 transition-all hover:border-[#20D6C2]/40 hover:bg-slate-50 hover:text-slate-900 focus:ring-2 focus:ring-[#20D6C2]/30 focus:outline-none dark:border-slate-700/50 dark:bg-[#111C30]/85 dark:text-[#F1F5F9] dark:hover:border-[#20D6C2]/40 dark:hover:bg-[#16233B]"
              title="Switch Language / تغییر زبان"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-500 dark:text-[#20D6C2]">
                <Globe className="h-5 w-5 shrink-0" strokeWidth={1.85} />
              </span>
              <span>{lang === 'en' ? 'فارسی' : 'EN'}</span>
            </button>

            {/* Theme Toggle IconButton (Exact 40x40px, 20x20px icon) */}
            <IconButton
              icon={theme === 'light' ? Moon : Sun}
              onClick={toggleTheme}
              title={lang === 'fa' ? 'تغییر پوسته روشن/تاریک' : 'Toggle Theme'}
              aria-label="Toggle Theme"
            />

            {/* Notifications IconButton (Exact 40x40px, 20x20px icon, absolute corner badge) */}
            <div ref={notifRef} className="relative flex h-10 w-10 items-center justify-center">
              <IconButton
                icon={Bell}
                badgeCount={unreadCount}
                active={notifOpen}
                onClick={openNotificationsDropdown}
                title={t.nav.notifications}
                aria-label={t.nav.notifications}
              />

              {notifOpen && (
                <div className="shopino-glass-modal absolute top-12 end-0 z-50 w-80 rounded-xl p-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-[#F1F5F9]">
                      {t.nav.notifications}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-medium text-[#0d9488] hover:underline dark:text-[#20D6C2]"
                      >
                        {lang === 'fa' ? 'خوانده‌شدن همه' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                    {recentNotifs.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-500 dark:text-[#94A3B8]">
                        {t.common.noRecords}
                      </p>
                    ) : (
                      recentNotifs.map((n) => (
                        <button
                          key={n.id}
                          onClick={async () => {
                            await apiFetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
                            await refreshSession();
                            setNotifOpen(false);
                            navigate(n.target_route || '/dashboard');
                          }}
                          className={`block w-full rounded-lg p-2.5 text-start text-xs transition-colors hover:bg-slate-100 dark:hover:bg-[#16233B] ${
                            !n.is_read
                              ? 'border border-[#20D6C2]/25 bg-[#20D6C2]/8 dark:bg-[#20D6C2]/10'
                              : ''
                          }`}
                        >
                          <div className="font-semibold text-slate-900 dark:text-[#F1F5F9]">
                            {lang === 'fa' ? n.title_fa : n.title_en}
                          </div>
                          <div className="mt-0.5 text-slate-600 dark:text-[#94A3B8]">
                            {lang === 'fa' ? n.message_fa : n.message_en}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Avatar Menu (Exact 40px height, vertically centered avatar & text) */}
            {user && (
              <div ref={profileRef} className="relative flex h-10 items-center">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((p) => !p);
                    setNotifOpen(false);
                  }}
                  className="m-0 inline-flex h-10 min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200/90 bg-white/90 px-2.5 text-xs font-semibold leading-none text-slate-700 transition-all hover:border-[#20D6C2]/40 hover:bg-slate-50 hover:text-slate-900 focus:ring-2 focus:ring-[#20D6C2]/30 focus:outline-none dark:border-slate-700/50 dark:bg-[#111C30]/85 dark:text-[#F1F5F9] dark:hover:border-[#20D6C2]/40 dark:hover:bg-[#16233B]"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#20D6C2] to-[#7C83FF] text-[11px] font-extrabold leading-none text-[#041417]">
                    {(lang === 'fa' ? user.name_fa : user.name).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-28 truncate md:inline">
                    {lang === 'fa' ? user.name_fa.split('(')[0].trim() : user.name}
                  </span>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 dark:text-[#94A3B8]">
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </span>
                </button>

                {profileOpen && (
                  <div className="shopino-glass-modal absolute top-12 end-0 z-50 w-64 rounded-xl p-3">
                    <div className="border-b border-slate-200/80 pb-2.5 dark:border-slate-800">
                      <div className="text-xs font-bold text-slate-900 dark:text-[#F1F5F9]">
                        {lang === 'fa' ? user.name_fa : user.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-[#94A3B8]">
                        {user.email}
                      </div>
                      <div className="mt-1.5 inline-flex items-center rounded-md border border-[#20D6C2]/30 bg-[#20D6C2]/10 px-2 py-0.5 text-[11px] font-semibold text-[#0d9488] dark:text-[#20D6C2]">
                        {t.roles[user.role]}
                      </div>
                    </div>

                    {allowDemoLogin && (
                      <div className="py-2">
                        <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 dark:text-[#94A3B8]">
                          {lang === 'fa' ? 'تغییر سریع نقش کاربری:' : 'Switch Active Role:'}
                        </div>
                        {(['owner', 'manager', 'sales', 'accountant', 'inventory'] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => handleSwitchDemoRole(r)}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                              user.role === r
                                ? 'bg-[#20D6C2]/15 font-semibold text-[#0d9488] dark:text-[#20D6C2]'
                                : 'text-slate-600 hover:bg-slate-100 dark:text-[#94A3B8] dark:hover:bg-[#16233B] dark:hover:text-[#F1F5F9]'
                            }`}
                          >
                            <span>{t.roles[r]}</span>
                            {user.role === r && <span>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-slate-200/80 pt-2 dark:border-slate-800">
                      <button
                        onClick={logout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/35"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{t.nav.logout}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Viewport */}
        <main className="shopino-page-enter flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* Global Confirmation Modal */}
      {confirmDialog && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#050912]/70 p-4 backdrop-blur-xs">
          <div className="shopino-glass-modal w-full max-w-md rounded-xl p-6">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F1F5F9]">
                {confirmDialog.title}
              </h3>
              <button
                onClick={closeConfirm}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-600 dark:text-[#94A3B8]">
              {confirmDialog.message}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={closeConfirm}>
                {t.common.cancel}
              </Button>
              <Button
                variant={confirmDialog.variant === 'primary' ? 'primary' : 'danger'}
                onClick={async () => {
                  const fn = confirmDialog.onConfirm;
                  closeConfirm();
                  await fn();
                }}
              >
                {confirmDialog.confirmLabel || t.common.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
