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
  const { currentPath, user, token, apiFetch, loginWithToken, refreshSession } = useApp();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(false);

  const cleanPath = currentPath.split('?')[0];

  useEffect(() => {
    const isPublic = cleanPath === '/landing' || cleanPath === '/login';
    if (!isPublic && !token && !user && !bootstrapping) {
      setBootstrapping(true);
      apiFetch('/api/auth/demo-role', {
        method: 'POST',
        body: JSON.stringify({ role: 'owner' }),
      })
        .then((res) => {
          loginWithToken(res.token, res.user);
          return refreshSession();
        })
        .catch(() => {})
        .finally(() => setBootstrapping(false));
    }
  }, [cleanPath, token, user, bootstrapping, apiFetch, loginWithToken, refreshSession]);

  if (cleanPath === '/landing') {
    return <LandingPage />;
  }

  if (cleanPath === '/login') {
    return <LoginPage />;
  }

  const triggerReload = () => setRefreshTrigger((prev) => prev + 1);

  let pageContent: React.ReactNode = <DashboardPage refreshTrigger={refreshTrigger} />;

  if (cleanPath === '/dashboard' || cleanPath === '/') {
    pageContent = <DashboardPage refreshTrigger={refreshTrigger} />;
  } else if (cleanPath === '/sales') {
    pageContent = <SalesPage refreshTrigger={refreshTrigger} />;
  } else if (cleanPath === '/orders') {
    pageContent = <OrdersPage refreshTrigger={refreshTrigger} />;
  } else if (cleanPath.startsWith('/orders/')) {
    const orderId = cleanPath.replace('/orders/', '');
    pageContent = <OrderDetailPage orderId={orderId} />;
  } else if (cleanPath === '/customers') {
    pageContent = <CustomersPage refreshTrigger={refreshTrigger} />;
  } else if (cleanPath.startsWith('/customers/')) {
    const customerId = cleanPath.replace('/customers/', '');
    pageContent = <CustomerDetailPage customerId={customerId} />;
  } else if (cleanPath === '/products') {
    pageContent = <ProductsPage refreshTrigger={refreshTrigger} />;
  } else if (cleanPath === '/payments') {
    pageContent = <PaymentsPage refreshTrigger={refreshTrigger} />;
  } else if (cleanPath === '/reports') {
    pageContent = <ReportsPage />;
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
