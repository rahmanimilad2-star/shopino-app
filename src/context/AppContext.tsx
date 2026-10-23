import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, translations } from '../i18n/translations.ts';

export interface User {
  id: string;
  name: string;
  name_fa: string;
  email: string;
  role: 'owner' | 'manager' | 'sales' | 'accountant' | 'inventory';
  status: string;
}

export interface BusinessSettings {
  businessName: string;
  businessNameFa: string;
  logoText?: string;
  taglineEn: string;
  taglineFa: string;
  phone: string;
  email: string;
  addressEn: string;
  addressFa: string;
  currency: string;
  usePersianCalendar: boolean;
  enableInventoryTracking: boolean;
  defaultPricingType: 'retail' | 'wholesale';
  timezone: string;
  defaultTaxRate: number;
  invoicePrefix: string;
  lowStockThresholdDefault: number;
  showDemoData: boolean;
  paymentMethods: string[];
  productCategories: string[];
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
}

interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  dir: 'ltr' | 'rtl';
  t: typeof translations.fa;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  user: User | null;
  token: string | null;
  allowDemoLogin: boolean;
  authConfigLoaded: boolean;
  settings: BusinessSettings;
  includeDemo: boolean;
  setIncludeDemo: (v: boolean) => void;
  unreadCount: number;
  refreshSession: () => Promise<void>;
  loginWithToken: (token: string, user: User) => void;
  logout: () => Promise<void>;
  currentPath: string;
  navigate: (path: string) => void;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  quickActionModal: 'customer' | 'product' | 'payment' | null;
  setQuickActionModal: (m: 'customer' | 'product' | 'payment' | null) => void;
  confirmDialog: ConfirmDialogOptions | null;
  requestConfirm: (options: ConfirmDialogOptions) => void;
  closeConfirm: () => void;
}

const defaultSettings: BusinessSettings = {
  businessName: 'Shopino',
  businessNameFa: 'شاپینو',
  logoText: 'SH',
  taglineEn: 'Simple Retail & Wholesale Sales, Customer Debt & Inventory App',
  taglineFa: 'سامانه ساده و هوشمند مدیریت فروش، مشتریان، بدهی‌ها و انبار',
  phone: '۰۲۱-۸۸۷۷۶۶۵۵',
  email: 'info@shopino.ir',
  addressEn: 'Unit 14, Bazar Bozorg Commercial Center, Tehran',
  addressFa: 'تهران، خیابان ولیعصر، مرکز تجاری ولیعصر، پلاک ۱۴',
  currency: 'TOMAN',
  usePersianCalendar: true,
  enableInventoryTracking: true,
  defaultPricingType: 'retail',
  timezone: 'Asia/Tehran',
  defaultTaxRate: 0,
  invoicePrefix: 'SHP-1404-',
  lowStockThresholdDefault: 5,
  showDemoData: true,
  paymentMethods: ['card', 'cash', 'bank_transfer', 'online', 'cheque'],
  productCategories: [
    'مواد غذایی و نوشیدنی',
    'لوازم دیجیتال و جانبی',
    'بهداشتی و شوینده',
    'ملزومات بسته‌بندی',
    'سایر کالاها',
  ],
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('shopino_lang');
    return saved === 'fa' || saved === 'en' ? saved : 'fa';
  });

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('shopino_theme_v2');
    const resolved = saved === 'light' || saved === 'dark' ? saved : 'dark';
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return resolved;
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('shopino_token'));
  const [user, setUser] = useState<User | null>(null);
  const [allowDemoLogin, setAllowDemoLogin] = useState<boolean>(false);
  const [authConfigLoaded, setAuthConfigLoaded] = useState<boolean>(false);
  const [settings, setSettings] = useState<BusinessSettings>(defaultSettings);
  const [includeDemo, setIncludeDemo] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) return hash;
    return localStorage.getItem('shopino_token') ? '/dashboard' : '/landing';
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [quickActionModal, setQuickActionModal] = useState<'customer' | 'product' | 'payment' | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const t = translations[lang];

  useEffect(() => {
    localStorage.setItem('shopino_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  useEffect(() => {
    localStorage.setItem('shopino_theme_v2', theme);
    localStorage.setItem('shopino_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace(/^#/, '');
      if (h) setCurrentPath(h);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((data) => {
        setAllowDemoLogin(Boolean(data?.allowDemoLogin));
      })
      .catch(() => {
        setAllowDemoLogin(false);
      })
      .finally(() => {
        setAuthConfigLoaded(true);
      });
  }, []);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const apiFetch = useCallback(
    async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }
      const activeToken = token || localStorage.getItem('shopino_token');
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }

      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 && activeToken) {
          localStorage.removeItem('shopino_token');
          setToken(null);
          setUser(null);
        }
        const err: any = new Error(data.error || `Request failed with status ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data as T;
    },
    [token]
  );

  const refreshSession = useCallback(async () => {
    const savedToken = token || localStorage.getItem('shopino_token');
    if (!savedToken) return;
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data.user);
      if (typeof data.allowDemoLogin === 'boolean') {
        setAllowDemoLogin(data.allowDemoLogin);
      }
      if (data.settings && Object.keys(data.settings).length > 0) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
      setUnreadCount(Number(data.unreadNotificationsCount || 0));
    } catch {
      localStorage.removeItem('shopino_token');
      setToken(null);
      setUser(null);
    }
  }, [token, apiFetch]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const loginWithToken = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('shopino_token', newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout network error
    }
    localStorage.removeItem('shopino_token');
    setToken(null);
    setUser(null);
    navigate('/login');
  }, [apiFetch, navigate]);

  const requestConfirm = useCallback((options: ConfirmDialogOptions) => {
    setConfirmDialog(options);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        dir,
        t,
        theme,
        toggleTheme,
        user,
        token,
        allowDemoLogin,
        authConfigLoaded,
        settings,
        includeDemo,
        setIncludeDemo,
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
        quickActionModal,
        setQuickActionModal,
        confirmDialog,
        requestConfirm,
        closeConfirm,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
