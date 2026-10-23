/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Layout } from './components/Layout.tsx';
import { QuickModals } from './components/QuickModals.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { SalesPage } from './pages/SalesPage.tsx';
import { OrdersPage } from './pages/OrdersPage.tsx';
import { OrderDetailPage } from './pages/OrderDetailPage.tsx';
import { CustomersPage } from './pages/CustomersPage.tsx';
import { CustomerDetailPage } from './pages/CustomerDetailPage.tsx';
import { ProductsPage } from './pages/ProductsPage.tsx';
import { PaymentsPage } from './pages/PaymentsPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

const RouterView: React.FC = () => {
  const {
    lang,
    currentPath,
    navigate,
    user,
    token,
    allowDemoLogin,
    authConfigLoaded,
    apiFetch,
    loginWithToken,
    refreshSession,
  } = useApp();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(false);

  const cleanPath = currentPath.split('?')[0];

  useEffect(() => {
    const isPublic = cleanPath === '/landing' || cleanPath === '/login';
    if (!authConfigLoaded || isPublic || token || user || bootstrapping) return;

    if (allowDemoLogin) {
      setBootstrapping(true);
      apiFetch('/api/auth/demo-role', {
        method: 'POST',
        body: JSON.stringify({ role: 'owner' }),
      })
        .then((res) => {
          loginWithToken(res.token, res.user);
          return refreshSession();
        })
        .catch(() => {
          navigate('/login');
        })
        .finally(() => setBootstrapping(false));
    } else {
      navigate('/login');
    }
  }, [
    cleanPath,
    token,
    user,
    allowDemoLogin,
    authConfigLoaded,
    bootstrapping,
    apiFetch,
    loginWithToken,
    refreshSession,
    navigate,
  ]);

  if (cleanPath === '/landing') {
    return <LandingPage />;
  }

  if (cleanPath === '/login') {
    return <LoginPage />;
  }

  if (!token && !user) {
    return <LoginPage />;
  }

  const triggerReload = () => setRefreshTrigger((prev) => prev + 1);
  const role = user?.role || 'owner';

  const renderForbidden = () => (
    <div className="shopino-glass-card rounded-xl p-8 text-center">
      <h2 className="text-base font-bold text-slate-900 dark:text-[#F1F5F9]">
        {lang === 'fa' ? 'عدم دسترسی به این بخش' : 'Access Restricted'}
      </h2>
      <p className="mt-2 text-xs text-slate-500 dark:text-[#94A3B8]">
        {lang === 'fa'
          ? 'نقش کاربری فعلی شما مجوز مشاهده یا انجام عملیات در این صفحه را ندارد.'
          : 'Your current user role does not have permission to access this section.'}
      </p>
    </div>
  );

  let pageContent: React.ReactNode = <DashboardPage refreshTrigger={refreshTrigger} />;

  if (cleanPath === '/dashboard' || cleanPath === '/') {
    pageContent = <DashboardPage refreshTrigger={refreshTrigger} />;
  } else if (cleanPath === '/sales') {
    pageContent = ['owner', 'manager', 'sales'].includes(role) ? (
      <SalesPage refreshTrigger={refreshTrigger} />
    ) : (
      renderForbidden()
    );
  } else if (cleanPath === '/orders') {
    pageContent = <OrdersPage refreshTrigger={refreshTrigger} />;
  } else if (cleanPath.startsWith('/orders/')) {
    const orderId = cleanPath.replace('/orders/', '');
    pageContent = <OrderDetailPage orderId={orderId} />;
  } else if (cleanPath === '/customers') {
    pageContent = ['owner', 'manager', 'sales', 'accountant'].includes(role) ? (
      <CustomersPage refreshTrigger={refreshTrigger} />
    ) : (
      renderForbidden()
    );
  } else if (cleanPath.startsWith('/customers/')) {
    const customerId = cleanPath.replace('/customers/', '');
    pageContent = ['owner', 'manager', 'sales', 'accountant'].includes(role) ? (
      <CustomerDetailPage customerId={customerId} />
    ) : (
      renderForbidden()
    );
  } else if (cleanPath === '/products') {
    pageContent = <ProductsPage refreshTrigger={refreshTrigger} />;
  } else if (cleanPath === '/payments') {
    pageContent = ['owner', 'manager', 'sales', 'accountant'].includes(role) ? (
      <PaymentsPage refreshTrigger={refreshTrigger} />
    ) : (
      renderForbidden()
    );
  } else if (cleanPath === '/reports') {
    pageContent = ['owner', 'manager', 'accountant'].includes(role) ? (
      <ReportsPage />
    ) : (
      renderForbidden()
    );
  } else if (cleanPath === '/settings') {
    pageContent = <SettingsPage />;
  }

  return (
    <Layout>
      {pageContent}
      <QuickModals onSuccess={triggerReload} />
    </Layout>
  );
};

export default function App() {
  return (
    <AppProvider>
      <RouterView />
    </AppProvider>
  );
}
