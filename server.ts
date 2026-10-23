import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import {
  initDb,
  queryAll,
  queryOne,
  executeSql,
  runTransaction,
  hashPassword,
  generateId,
  toCents,
  fromCents,
  seedDemoData,
  purgeDemoData,
} from './src/server/db.ts';

const PORT = 3000;

interface AuthUser {
  id: string;
  name: string;
  name_fa: string;
  email: string;
  role: 'owner' | 'manager' | 'sales' | 'accountant' | 'inventory';
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 25) {
    return false;
  }
  entry.count += 1;
  return true;
}

function logAudit(
  user: AuthUser | undefined,
  action: string,
  entityType: string,
  entityId: string,
  summary: string
) {
  executeSql(
    `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId('aud'),
      user?.id || 'system',
      user?.name || 'System',
      user?.role || 'system',
      action,
      entityType,
      entityId,
      summary,
      new Date().toISOString(),
    ]
  );
}

function getBusinessSettings(): Record<string, any> {
  const row = queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'business_config'");
  return row ? JSON.parse(row.value) : { enableInventoryTracking: true, invoicePrefix: 'SHP-1404-' };
}

function isInventoryTrackingEnabled(): boolean {
  const s = getBusinessSettings();
  return s.enableInventoryTracking !== false;
}

function computeOrderFinancials(orderRow: any) {
  const validPayments = queryOne<{ paid: number; refunded: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN payment_type IN ('collection', 'advance') AND provider_confirmed = 1 THEN amount_cents ELSE 0 END), 0) as paid,
       COALESCE(SUM(CASE WHEN payment_type = 'refund' AND provider_confirmed = 1 THEN amount_cents ELSE 0 END), 0) as refunded
     FROM payments
     WHERE order_id = ?`,
    [orderRow.id]
  );

  const netPaidCents = (validPayments?.paid || 0) - (validPayments?.refunded || 0);
  const isCancelled = orderRow.status === 'cancelled';
  const effectiveTotalCents = isCancelled ? 0 : orderRow.final_total_cents;
  const outstandingCents = Math.max(0, effectiveTotalCents - netPaidCents);

  let paymentStatus: 'paid' | 'partially_paid' | 'unpaid' = 'unpaid';
  if (isCancelled) {
    paymentStatus = netPaidCents > 0 ? 'paid' : 'unpaid';
  } else if (netPaidCents >= orderRow.final_total_cents && orderRow.final_total_cents > 0) {
    paymentStatus = 'paid';
  } else if (netPaidCents > 0 && netPaidCents < orderRow.final_total_cents) {
    paymentStatus = 'partially_paid';
  } else {
    paymentStatus = 'unpaid';
  }

  return {
    netPaidCents,
    outstandingCents,
    paymentStatus,
  };
}

function computeCustomerLedgerSummary(customerId: string, includeDemo: boolean) {
  const demoClause = includeDemo ? '' : 'AND is_demo = 0';

  const orderTotals = queryOne<{ total_purchases: number; order_count: number; last_order_date: string | null }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status != 'cancelled' THEN final_total_cents ELSE 0 END), 0) as total_purchases,
       COUNT(CASE WHEN status != 'cancelled' THEN 1 END) as order_count,
       MAX(order_date) as last_order_date
     FROM orders
     WHERE customer_id = ? ${demoClause}`,
    [customerId]
  );

  const paymentTotals = queryOne<{ total_paid: number; total_refunded: number; last_payment_date: string | null }>(
    `SELECT
       COALESCE(SUM(CASE WHEN payment_type IN ('collection', 'advance') AND provider_confirmed = 1 THEN amount_cents ELSE 0 END), 0) as total_paid,
       COALESCE(SUM(CASE WHEN payment_type = 'refund' AND provider_confirmed = 1 THEN amount_cents ELSE 0 END), 0) as total_refunded,
       MAX(payment_date) as last_payment_date
     FROM payments
     WHERE customer_id = ? ${demoClause}`,
    [customerId]
  );

  const totalPurchasesCents = orderTotals?.total_purchases || 0;
  const netPaymentsCents = (paymentTotals?.total_paid || 0) - (paymentTotals?.total_refunded || 0);
  const outstandingBalanceCents = totalPurchasesCents - netPaymentsCents;

  const lastActivity =
    [orderTotals?.last_order_date, paymentTotals?.last_payment_date]
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

  return {
    orderCount: orderTotals?.order_count || 0,
    totalPurchases: fromCents(totalPurchasesCents),
    totalPayments: fromCents(netPaymentsCents),
    outstandingBalance: fromCents(outstandingBalanceCents),
    lastActivity,
  };
}

async function startServer() {
  await initDb();

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Auth Middleware
  app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const session = queryOne<{ user_id: string; expires_at: string }>(
        'SELECT user_id, expires_at FROM sessions WHERE token = ?',
        [token]
      );
      if (session && new Date(session.expires_at) > new Date()) {
        const user = queryOne<AuthUser>(
          'SELECT id, name, name_fa, email, role, status FROM users WHERE id = ?',
          [session.user_id]
        );
        if (user && user.status === 'active') {
          req.user = user;
        }
      }
    }
    next();
  });

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }
    next();
  };

  // =========================================================================
  // 1. AUTHENTICATION & PROFILE ROUTES
  // =========================================================================
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً کمی صبر کنید.' });
      return;
    }

    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'ایمیل و رمز عبور الزامی است.' });
      return;
    }

    const user = queryOne<AuthUser & { password_hash: string }>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
      [String(email).trim()]
    );

    if (!user || user.password_hash !== hashPassword(password)) {
      res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است.' });
      return;
    }

    const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    executeSql('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [
      token,
      user.id,
      expires.toISOString(),
      now.toISOString(),
    ]);
    executeSql('UPDATE users SET last_login = ? WHERE id = ?', [now.toISOString(), user.id]);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        name_fa: user.name_fa,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  });

  app.post('/api/auth/demo-role', (req: Request, res: Response) => {
    const { role } = req.body;
    const validRoles = ['owner', 'manager', 'sales', 'accountant', 'inventory'];
    const targetRole = validRoles.includes(role) ? role : 'owner';

    const user = queryOne<AuthUser>('SELECT id, name, name_fa, email, role, status FROM users WHERE role = ? LIMIT 1', [
      targetRole,
    ]);
    if (!user) {
      res.status(404).json({ error: 'کاربر نمونه یافت نشد.' });
      return;
    }

    const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    executeSql('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [
      token,
      user.id,
      expires.toISOString(),
      now.toISOString(),
    ]);

    res.json({ token, user });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      executeSql('DELETE FROM sessions WHERE token = ?', [authHeader.slice(7)]);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const settings = getBusinessSettings();
    const unreadNotifs = queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0'
    );
    res.json({
      user: req.user,
      settings,
      unreadNotificationsCount: unreadNotifs?.cnt || 0,
    });
  });

  app.put('/api/auth/profile', requireAuth, (req: Request, res: Response) => {
    const { name, name_fa, email, newPassword } = req.body;
    if (!req.user) return;

    executeSql('UPDATE users SET name = ?, name_fa = ?, email = ? WHERE id = ?', [
      name || req.user.name,
      name_fa || name || req.user.name_fa,
      email || req.user.email,
      req.user.id,
    ]);

    if (newPassword && String(newPassword).trim().length >= 6) {
      executeSql('UPDATE users SET password_hash = ? WHERE id = ?', [
        hashPassword(String(newPassword).trim()),
        req.user.id,
      ]);
    }

    res.json({ ok: true });
  });

  // =========================================================================
  // 2. GLOBAL SEARCH
  // =========================================================================
  app.get('/api/search', requireAuth, (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ customers: [], orders: [], products: [] });
      return;
    }
    const like = `%${q}%`;
    const customers = queryAll(
      `SELECT id, code, name, phone, customer_type FROM customers
       WHERE name LIKE ? OR code LIKE ? OR phone LIKE ? LIMIT 5`,
      [like, like, like]
    );
    const orders = queryAll(
      `SELECT o.id, o.order_number, o.order_date, o.status, o.final_total_cents,
              COALESCE(c.name, 'مشتری حضوری') as customer_name
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.order_number LIKE ? OR c.name LIKE ? LIMIT 5`,
      [like, like]
    ).map((o) => ({ ...o, final_total: fromCents(o.final_total_cents) }));

    const products = queryAll(
      `SELECT id, sku, name, name_fa, sale_price_cents, wholesale_price_cents, stock_quantity FROM products
       WHERE name LIKE ? OR name_fa LIKE ? OR sku LIKE ? LIMIT 5`,
      [like, like, like]
    ).map((p) => ({
      ...p,
      sale_price: fromCents(p.sale_price_cents),
      wholesale_price: fromCents(p.wholesale_price_cents),
    }));

    res.json({ customers, orders, products });
  });

  // =========================================================================
  // 3. DASHBOARD OVERVIEW (5 Key Questions + 2 Charts + Lists)
  // =========================================================================
  app.get('/api/dashboard', requireAuth, (req: Request, res: Response) => {
    const includeDemo = req.query.includeDemo !== 'false';
    const startDate = String(req.query.startDate || '2000-01-01');
    const endDate = String(req.query.endDate || '2099-12-31');
    const todayStr = new Date().toISOString().slice(0, 10);
    const demoFilter = includeDemo ? '' : 'AND is_demo = 0';

    // All non-cancelled orders in selected period
    const ordersInPeriod = queryAll<any>(
      `SELECT * FROM orders
       WHERE order_date >= ? AND order_date <= ? ${demoFilter}
       ORDER BY order_date DESC, created_at DESC`,
      [startDate, endDate]
    );

    let periodSalesCents = 0;
    let periodOrdersCount = 0;

    for (const o of ordersInPeriod) {
      if (o.status !== 'cancelled') {
        periodSalesCents += o.final_total_cents;
        periodOrdersCount += 1;
      }
    }

    // Today's sales & orders specifically
    const todayOrders = queryAll<any>(
      `SELECT * FROM orders WHERE order_date = ? AND status != 'cancelled' ${demoFilter}`,
      [todayStr]
    );
    const todaySalesCents = todayOrders.reduce((s, o) => s + o.final_total_cents, 0);
    const todayOrdersCount = todayOrders.length;

    // Payments in period
    const paymentsInPeriod = queryAll<any>(
      `SELECT * FROM payments
       WHERE payment_date >= ? AND payment_date <= ? AND provider_confirmed = 1 ${demoFilter}`,
      [startDate, endDate]
    );
    let periodReceivedCents = 0;
    for (const p of paymentsInPeriod) {
      if (p.payment_type === 'collection' || p.payment_type === 'advance') {
        periodReceivedCents += p.amount_cents;
      } else if (p.payment_type === 'refund') {
        periodReceivedCents -= p.amount_cents;
      }
    }

    // Today's received payments
    const todayPayments = queryAll<any>(
      `SELECT * FROM payments WHERE payment_date = ? AND provider_confirmed = 1 ${demoFilter}`,
      [todayStr]
    );
    let todayReceivedCents = 0;
    for (const p of todayPayments) {
      if (p.payment_type === 'collection' || p.payment_type === 'advance') {
        todayReceivedCents += p.amount_cents;
      } else if (p.payment_type === 'refund') {
        todayReceivedCents -= p.amount_cents;
      }
    }

    // Customer Debts across active customers
    const activeCustomers = queryAll<any>(
      `SELECT * FROM customers WHERE status = 'active' ${demoFilter}`
    );
    let totalCustomerDebtsCents = 0;
    const customerSummaries = activeCustomers.map((c) => {
      const summary = computeCustomerLedgerSummary(c.id, includeDemo);
      if (summary.outstandingBalance > 0) {
        totalCustomerDebtsCents += toCents(summary.outstandingBalance);
      }
      return {
        ...c,
        ...summary,
      };
    });

    // Low stock products
    const lowStockProducts = queryAll<any>(
      `SELECT * FROM products
       WHERE status = 'active' AND stock_quantity <= min_stock_threshold ${demoFilter}
       ORDER BY stock_quantity ASC`
    ).map((p) => ({
      ...p,
      cost_price: fromCents(p.cost_price_cents),
      sale_price: fromCents(p.sale_price_cents),
      wholesale_price: fromCents(p.wholesale_price_cents),
    }));

    // ChartData: Group by date for the 2 charts (Sales over time, Sales vs Received Payments)
    const dateBuckets = new Map<string, { date: string; sales: number; received: number }>();

    for (const o of ordersInPeriod) {
      if (o.status !== 'cancelled') {
        const d = o.order_date;
        const cur = dateBuckets.get(d) || { date: d, sales: 0, received: 0 };
        cur.sales += fromCents(o.final_total_cents);
        dateBuckets.set(d, cur);
      }
    }
    for (const p of paymentsInPeriod) {
      const d = p.payment_date;
      const cur = dateBuckets.get(d) || { date: d, sales: 0, received: 0 };
      if (p.payment_type !== 'refund') {
        cur.received += fromCents(p.amount_cents);
      }
      dateBuckets.set(d, cur);
    }

    const chartTrend = Array.from(dateBuckets.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Recent Sales & Orders
    const recentOrders = queryAll<any>(
      `SELECT o.*, COALESCE(c.name, 'مشتری حضوری (نقدی)') as customer_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE 1=1 ${includeDemo ? '' : 'AND o.is_demo = 0'}
       ORDER BY o.order_date DESC, o.created_at DESC
       LIMIT 6`
    ).map((o) => {
      const fin = computeOrderFinancials(o);
      return {
        ...o,
        final_total: fromCents(o.final_total_cents),
        amount_paid: fromCents(fin.netPaidCents),
        outstanding_balance: fromCents(fin.outstandingCents),
        payment_status: fin.paymentStatus,
      };
    });

    const debtorCustomers = [...customerSummaries]
      .filter((c) => c.outstandingBalance > 0)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
      .slice(0, 6);

    res.json({
      kpis: {
        todaySales: fromCents(todaySalesCents),
        periodSales: fromCents(periodSalesCents),
        todayReceived: fromCents(todayReceivedCents),
        periodReceived: fromCents(periodReceivedCents),
        customerDebts: fromCents(totalCustomerDebtsCents),
        todayOrdersCount,
        periodOrdersCount,
        lowStockCount: lowStockProducts.length,
      },
      chartTrend,
      recentOrders,
      debtorCustomers,
      lowStockProducts,
    });
  });

  // =========================================================================
  // 4. CUSTOMERS ROUTES
  // =========================================================================
  app.get('/api/customers', requireAuth, (req: Request, res: Response) => {
    const includeDemo = req.query.includeDemo !== 'false';
    const demoClause = includeDemo ? '' : 'WHERE is_demo = 0';
    const rows = queryAll<any>(`SELECT * FROM customers ${demoClause} ORDER BY created_at DESC`);
    const enriched = rows.map((c) => {
      const ledger = computeCustomerLedgerSummary(c.id, includeDemo);
      return {
        ...c,
        total_purchases: ledger.totalPurchases,
        total_payments: ledger.totalPayments,
        outstanding_balance: ledger.outstandingBalance,
        order_count: ledger.orderCount,
        last_activity: ledger.lastActivity,
      };
    });
    res.json({ customers: enriched });
  });

  app.get('/api/customers/:id', requireAuth, (req: Request, res: Response) => {
    const customer = queryOne<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      res.status(404).json({ error: 'مشتری یافت نشد.' });
      return;
    }

    const ledger = computeCustomerLedgerSummary(customer.id, true);
    const orders = queryAll<any>(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC, created_at DESC',
      [customer.id]
    ).map((o) => {
      const fin = computeOrderFinancials(o);
      return {
        ...o,
        subtotal: fromCents(o.subtotal_cents),
        discount: fromCents(o.item_discount_cents + o.order_discount_cents),
        tax: fromCents(o.tax_cents),
        final_total: fromCents(o.final_total_cents),
        amount_paid: fromCents(fin.netPaidCents),
        outstanding_balance: fromCents(fin.outstandingCents),
        payment_status: fin.paymentStatus,
      };
    });

    const payments = queryAll<any>(
      `SELECT p.*, o.order_number
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       WHERE p.customer_id = ?
       ORDER BY p.payment_date DESC, p.created_at DESC`,
      [customer.id]
    ).map((p) => ({
      ...p,
      amount: fromCents(p.amount_cents),
    }));

    const notes = queryAll<any>(
      'SELECT * FROM customer_notes WHERE customer_id = ? ORDER BY created_at DESC',
      [customer.id]
    );

    res.json({
      customer: {
        ...customer,
        total_purchases: ledger.totalPurchases,
        total_payments: ledger.totalPayments,
        outstanding_balance: ledger.outstandingBalance,
        order_count: ledger.orderCount,
        last_activity: ledger.lastActivity,
      },
      orders,
      payments,
      notes,
    });
  });

  app.post('/api/customers', requireAuth, (req: Request, res: Response) => {
    const { name, phone, email, address, customer_type, tags, notes } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'نام مشتری الزامی است.' });
      return;
    }

    const id = generateId('cust');
    const countRow = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM customers');
    const code = `C-${101 + (countRow?.cnt || 0)}`;
    const now = new Date().toISOString();

    executeSql(
      `INSERT INTO customers (id, code, name, phone, email, address, customer_type, tags, notes, status, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`,
      [
        id,
        code,
        String(name).trim(),
        String(phone || '').trim(),
        String(email || '').trim(),
        String(address || '').trim(),
        customer_type === 'wholesale' ? 'wholesale' : 'retail',
        String(tags || '').trim(),
        String(notes || '').trim(),
        now,
        now,
      ]
    );

    logAudit(req.user, 'CREATE', 'customer', id, `Created customer ${name} (${code})`);
    res.status(201).json({ id, code });
  });

  app.put('/api/customers/:id', requireAuth, (req: Request, res: Response) => {
    const { name, phone, email, address, customer_type, tags, notes, status } = req.body;
    const existing = queryOne<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'مشتری یافت نشد.' });
      return;
    }

    const now = new Date().toISOString();
    executeSql(
      `UPDATE customers
       SET name = ?, phone = ?, email = ?, address = ?, customer_type = ?, tags = ?, notes = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        name ?? existing.name,
        phone ?? existing.phone,
        email ?? existing.email,
        address ?? existing.address,
        customer_type ?? existing.customer_type,
        tags ?? existing.tags,
        notes ?? existing.notes,
        status ?? existing.status,
        now,
        existing.id,
      ]
    );

    logAudit(req.user, 'UPDATE', 'customer', existing.id, `Updated customer ${name || existing.name}`);
    res.json({ ok: true });
  });

  app.delete('/api/customers/:id', requireAuth, (req: Request, res: Response) => {
    const orderCount = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM orders WHERE customer_id = ?', [
      req.params.id,
    ]);
    if (orderCount && orderCount.cnt > 0) {
      res.status(400).json({
        error: 'این مشتری دارای سابقه فاکتور است. برای حفظ دقت حساب‌ها، به جای حذف، او را بایگانی کنید.',
      });
      return;
    }

    executeSql('DELETE FROM customer_notes WHERE customer_id = ?', [req.params.id]);
    executeSql('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  });

  // =========================================================================
  // 5. PRODUCTS & INVENTORY ROUTES
  // =========================================================================
  app.get('/api/products', requireAuth, (req: Request, res: Response) => {
    const includeDemo = req.query.includeDemo !== 'false';
    const demoClause = includeDemo ? '' : 'WHERE is_demo = 0';
    const rows = queryAll<any>(`SELECT * FROM products ${demoClause} ORDER BY created_at DESC`).map((p) => {
      const marginCents = p.sale_price_cents - p.cost_price_cents;
      const marginPercent =
        p.sale_price_cents > 0 && p.cost_price_cents > 0
          ? Math.round((marginCents / p.sale_price_cents) * 1000) / 10
          : 0;
      return {
        ...p,
        cost_price: fromCents(p.cost_price_cents),
        sale_price: fromCents(p.sale_price_cents),
        wholesale_price: fromCents(p.wholesale_price_cents),
        unit_profit: p.cost_price_cents > 0 ? fromCents(marginCents) : null,
        margin_percent: marginPercent,
      };
    });
    res.json({ products: rows });
  });

  app.post('/api/products', requireAuth, (req: Request, res: Response) => {
    const {
      sku,
      name,
      name_fa,
      category,
      notes,
      unit,
      cost_price,
      sale_price,
      wholesale_price,
      stock_quantity,
      min_stock_threshold,
    } = req.body;

    if (!name || sale_price === undefined || Number(sale_price) < 0) {
      res.status(400).json({ error: 'نام کالا و قیمت فروش الزامی است.' });
      return;
    }

    const countRow = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products');
    const finalSku =
      sku && String(sku).trim() ? String(sku).trim().toUpperCase() : `P-${1001 + (countRow?.cnt || 0)}`;

    const id = generateId('prd');
    const now = new Date().toISOString();
    const initialStock = Math.max(0, Number(stock_quantity || 0));

    runTransaction(() => {
      executeSql(
        `INSERT INTO products (id, sku, name, name_fa, category, description, notes, unit, cost_price_cents, sale_price_cents, wholesale_price_cents, stock_quantity, min_stock_threshold, product_type, status, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'physical', 'active', 0, ?, ?)`,
        [
          id,
          finalSku,
          String(name).trim(),
          String(name_fa || name).trim(),
          String(category || 'عمومی').trim(),
          String(notes || '').trim(),
          String(notes || '').trim(),
          unit || 'piece',
          toCents(cost_price || 0),
          toCents(sale_price),
          toCents(wholesale_price || sale_price),
          initialStock,
          Number(min_stock_threshold ?? 5),
          now,
          now,
        ]
      );

      if (initialStock > 0) {
        executeSql(
          `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at)
           VALUES (?, ?, 'addition', ?, 0, ?, 'INIT', 'موجودی اولیه هنگام تعریف کالا', ?, 0, ?)`,
          [generateId('mov'), id, initialStock, initialStock, req.user?.name || 'Admin', now]
        );
      }
    });

    res.status(201).json({ id, sku: finalSku });
  });

  app.put('/api/products/:id', requireAuth, (req: Request, res: Response) => {
    const existing = queryOne<any>('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'کالا یافت نشد.' });
      return;
    }

    const {
      sku,
      name,
      name_fa,
      category,
      notes,
      unit,
      cost_price,
      sale_price,
      wholesale_price,
      min_stock_threshold,
      status,
    } = req.body;
    const now = new Date().toISOString();

    executeSql(
      `UPDATE products
       SET sku = ?, name = ?, name_fa = ?, category = ?, description = ?, notes = ?, unit = ?,
           cost_price_cents = ?, sale_price_cents = ?, wholesale_price_cents = ?,
           min_stock_threshold = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        sku ?? existing.sku,
        name ?? existing.name,
        name_fa ?? name ?? existing.name_fa,
        category ?? existing.category,
        notes ?? existing.description,
        notes ?? existing.notes,
        unit ?? existing.unit,
        cost_price !== undefined ? toCents(cost_price) : existing.cost_price_cents,
        sale_price !== undefined ? toCents(sale_price) : existing.sale_price_cents,
        wholesale_price !== undefined ? toCents(wholesale_price) : existing.wholesale_price_cents,
        min_stock_threshold !== undefined ? Number(min_stock_threshold) : existing.min_stock_threshold,
        status ?? existing.status,
        now,
        existing.id,
      ]
    );

    res.json({ ok: true });
  });

  app.get('/api/inventory/movements', requireAuth, (req: Request, res: Response) => {
    const includeDemo = req.query.includeDemo !== 'false';
    const demoClause = includeDemo ? '' : 'WHERE m.is_demo = 0';
    const rows = queryAll<any>(
      `SELECT m.*, p.name as product_name, p.name_fa as product_name_fa, p.sku, p.unit
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
       ${demoClause}
       ORDER BY m.created_at DESC`
    );
    res.json({ movements: rows });
  });

  app.post('/api/inventory/adjust', requireAuth, (req: Request, res: Response) => {
    const { product_id, movement_type, quantity_change, reason } = req.body;
    const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      res.status(404).json({ error: 'کالا یافت نشد.' });
      return;
    }

    const delta = Number(quantity_change);
    if (!delta || isNaN(delta)) {
      res.status(400).json({ error: 'مقدار تغییر موجودی باید عددی غیرصفر باشد.' });
      return;
    }

    const newStock = product.stock_quantity + delta;
    if (newStock < 0) {
      res.status(400).json({
        error: `موجودی انبار نمی‌تواند منفی شود. موجودی فعلی: ${product.stock_quantity}`,
      });
      return;
    }

    const now = new Date().toISOString();
    runTransaction(() => {
      executeSql('UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?', [
        newStock,
        now,
        product.id,
      ]);
      executeSql(
        `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?, 0, ?)`,
        [
          generateId('mov'),
          product.id,
          movement_type || (delta > 0 ? 'addition' : 'reduction'),
          delta,
          product.stock_quantity,
          newStock,
          String(reason || 'اصلاح دستی موجودی').trim(),
          req.user?.name || 'Admin',
          now,
        ]
      );
    });

    res.json({ ok: true, new_stock: newStock });
  });

  // =========================================================================
  // 6. FAST SALES & ORDERS ROUTES
  // =========================================================================
  app.get('/api/orders', requireAuth, (req: Request, res: Response) => {
    const includeDemo = req.query.includeDemo !== 'false';
    const demoClause = includeDemo ? '' : 'WHERE o.is_demo = 0';
    const rows = queryAll<any>(
      `SELECT o.*,
              COALESCE(c.name, 'مشتری حضوری (نقدی)') as customer_name,
              COALESCE(c.code, 'WALK-IN') as customer_code,
              COALESCE(c.customer_type, o.pricing_type) as customer_type
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       ${demoClause}
       ORDER BY o.order_date DESC, o.created_at DESC`
    );

    const enriched = rows.map((o) => {
      const fin = computeOrderFinancials(o);
      const items = queryAll<any>('SELECT * FROM order_items WHERE order_id = ?', [o.id]).map((it) => ({
        ...it,
        unit_price: fromCents(it.unit_price_cents),
        unit_cost: fromCents(it.unit_cost_cents),
        discount: fromCents(it.discount_cents),
        line_total: fromCents(it.line_total_cents),
      }));

      return {
        ...o,
        subtotal: fromCents(o.subtotal_cents),
        item_discount: fromCents(o.item_discount_cents),
        order_discount: fromCents(o.order_discount_cents),
        tax: fromCents(o.tax_cents),
        final_total: fromCents(o.final_total_cents),
        cost_total: fromCents(o.cost_total_cents),
        amount_paid: fromCents(fin.netPaidCents),
        outstanding_balance: fromCents(fin.outstandingCents),
        payment_status: fin.paymentStatus,
        items,
      };
    });

    res.json({ orders: enriched });
  });

  app.get('/api/orders/:id', requireAuth, (req: Request, res: Response) => {
    const order = queryOne<any>(
      `SELECT o.*,
              COALESCE(c.name, 'مشتری حضوری (نقدی)') as customer_name,
              COALESCE(c.code, 'WALK-IN') as customer_code,
              COALESCE(c.phone, '—') as customer_phone,
              COALESCE(c.address, '') as customer_address
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) {
      res.status(404).json({ error: 'سفارش یافت نشد.' });
      return;
    }

    const fin = computeOrderFinancials(order);
    const items = queryAll<any>('SELECT * FROM order_items WHERE order_id = ?', [order.id]).map((it) => ({
      ...it,
      unit_price: fromCents(it.unit_price_cents),
      unit_cost: fromCents(it.unit_cost_cents),
      discount: fromCents(it.discount_cents),
      tax: fromCents(it.tax_cents),
      line_total: fromCents(it.line_total_cents),
    }));

    const payments = queryAll<any>(
      'SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC, created_at DESC',
      [order.id]
    ).map((p) => ({
      ...p,
      amount: fromCents(p.amount_cents),
    }));

    res.json({
      order: {
        ...order,
        subtotal: fromCents(order.subtotal_cents),
        item_discount: fromCents(order.item_discount_cents),
        order_discount: fromCents(order.order_discount_cents),
        tax: fromCents(order.tax_cents),
        final_total: fromCents(order.final_total_cents),
        cost_total: fromCents(order.cost_total_cents),
        amount_paid: fromCents(fin.netPaidCents),
        outstanding_balance: fromCents(fin.outstandingCents),
        payment_status: fin.paymentStatus,
      },
      items,
      payments,
    });
  });

  app.post('/api/orders', requireAuth, (req: Request, res: Response) => {
    const {
      customer_id,
      pricing_type,
      order_date,
      due_date,
      status,
      order_discount,
      notes,
      items,
      initial_payment_amount,
      initial_payment_method,
      initial_payment_reference,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'حداقل یک کالا باید به فاکتور اضافه شود.' });
      return;
    }

    const normalizedCustomerId =
      customer_id && String(customer_id).trim() && customer_id !== 'walk-in' ? String(customer_id).trim() : null;

    if (normalizedCustomerId) {
      const customer = queryOne<any>('SELECT * FROM customers WHERE id = ?', [normalizedCustomerId]);
      if (!customer) {
        res.status(404).json({ error: 'مشتری انتخاب‌شده یافت نشد.' });
        return;
      }
    }

    const orderStatus = status || 'completed';
    const shouldDeductStock = orderStatus !== 'cancelled' && isInventoryTrackingEnabled();
    const settings = getBusinessSettings();
    const prefix = settings.invoicePrefix || 'SHP-1404-';
    const countRow = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM orders');
    const orderNumber = `${prefix}${1001 + (countRow?.cnt || 0)}`;
    const orderId = generateId('ord');
    const now = new Date().toISOString();
    const orderDateStr = order_date || now.slice(0, 10);

    try {
      const result = runTransaction(() => {
        let subtotalCents = 0;
        let itemDiscountCents = 0;
        let costTotalCents = 0;

        for (const line of items) {
          const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [line.product_id]);
          if (!product) {
            throw new Error(`کالا یافت نشد.`);
          }
          const qty = Math.max(1, Math.round(Number(line.quantity || 1)));
          if (shouldDeductStock && product.stock_quantity < qty) {
            throw new Error(
              `موجودی کالای «${product.name}» کافی نیست. موجودی فعلی: ${product.stock_quantity}، تعداد درخواستی: ${qty}`
            );
          }

          const unitPriceCents = toCents(line.unit_price ?? product.sale_price_cents);
          const lineDiscountCents = toCents(line.discount || 0);
          const lineGrossCents = unitPriceCents * qty;
          const lineTotalCents = Math.max(0, lineGrossCents - lineDiscountCents);

          subtotalCents += lineGrossCents;
          itemDiscountCents += lineDiscountCents;
          costTotalCents += product.cost_price_cents * qty;

          executeSql(
            `INSERT INTO order_items (id, order_id, product_id, product_name, sku, quantity, unit_price_cents, unit_cost_cents, discount_cents, tax_rate, tax_cents, line_total_cents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
            [
              generateId('item'),
              orderId,
              product.id,
              product.name,
              product.sku,
              qty,
              unitPriceCents,
              product.cost_price_cents,
              lineDiscountCents,
              lineTotalCents,
            ]
          );

          if (shouldDeductStock) {
            const newStock = product.stock_quantity - qty;
            executeSql('UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?', [
              newStock,
              now,
              product.id,
            ]);
            executeSql(
              `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at)
               VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, ?, 0, ?)`,
              [
                generateId('mov'),
                product.id,
                -qty,
                product.stock_quantity,
                newStock,
                orderNumber,
                `کسر بابت فروش فاکتور ${orderNumber}`,
                req.user?.name || 'Seller',
                now,
              ]
            );
          }
        }

        const orderDiscCents = toCents(order_discount || 0);
        const finalTotalCents = Math.max(0, subtotalCents - itemDiscountCents - orderDiscCents);

        // Anonymous walk-in sales cannot remain unpaid on credit without a customer account
        const initPayCents = toCents(initial_payment_amount || 0);
        if (!normalizedCustomerId && initPayCents < finalTotalCents && orderStatus !== 'cancelled') {
          throw new Error(
            'فروش نسیه یا پرداخت ناقص نیازمند انتخاب مشتری است. برای مشتری حضوری (بدون نام) وجه فاکتور باید کامل تسویه شود.'
          );
        }

        executeSql(
          `INSERT INTO orders (id, order_number, customer_id, pricing_type, order_date, due_date, status, subtotal_cents, item_discount_cents, order_discount_cents, tax_cents, final_total_cents, cost_total_cents, notes, inventory_deducted, created_by, is_demo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            orderId,
            orderNumber,
            normalizedCustomerId,
            pricing_type === 'wholesale' ? 'wholesale' : 'retail',
            orderDateStr,
            due_date || orderDateStr,
            orderStatus,
            subtotalCents,
            itemDiscountCents,
            orderDiscCents,
            finalTotalCents,
            costTotalCents,
            String(notes || '').trim(),
            shouldDeductStock ? 1 : 0,
            req.user?.name || 'Admin',
            now,
            now,
          ]
        );

        if (initPayCents > 0) {
          const payCount = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM payments');
          const payNumber = `REC-1404-${501 + (payCount?.cnt || 0)}`;
          executeSql(
            `INSERT INTO payments (id, payment_number, customer_id, order_id, payment_date, amount_cents, payment_type, payment_method, reference_number, notes, provider_confirmed, recorded_by, is_demo, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'collection', ?, ?, ?, 1, ?, 0, ?)`,
            [
              generateId('pay'),
              payNumber,
              normalizedCustomerId,
              orderId,
              orderDateStr,
              initPayCents,
              initial_payment_method || 'card',
              String(initial_payment_reference || '').trim(),
              `دریافت وجه هم‌زمان با ثبت فاکتور ${orderNumber}`,
              req.user?.name || 'Admin',
              now,
            ]
          );
        }

        return { id: orderId, order_number: orderNumber, final_total: fromCents(finalTotalCents) };
      });

      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'خطا در ثبت فاکتور' });
    }
  });

  app.patch('/api/orders/:id/status', requireAuth, (req: Request, res: Response) => {
    const { status } = req.body;
    const validStatuses = ['registered', 'preparing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'وضعیت سفارش نامعتبر است.' });
      return;
    }

    const order = queryOne<any>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      res.status(404).json({ error: 'فاکتور یافت نشد.' });
      return;
    }

    const now = new Date().toISOString();
    const items = queryAll<any>('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const trackStock = isInventoryTrackingEnabled();

    try {
      runTransaction(() => {
        const wasDeducted = order.inventory_deducted === 1;
        const shouldBeDeducted = status !== 'cancelled';

        if (!wasDeducted && shouldBeDeducted && trackStock) {
          for (const it of items) {
            const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [it.product_id]);
            if (product) {
              if (product.stock_quantity < it.quantity) {
                throw new Error(`موجودی کالای «${product.name}» کافی نیست.`);
              }
              const newStock = product.stock_quantity - it.quantity;
              executeSql('UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?', [
                newStock,
                now,
                product.id,
              ]);
              executeSql(
                `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at)
                 VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  generateId('mov'),
                  product.id,
                  -it.quantity,
                  product.stock_quantity,
                  newStock,
                  order.order_number,
                  `تأیید فاکتور ${order.order_number}`,
                  req.user?.name || 'Admin',
                  order.is_demo,
                  now,
                ]
              );
            }
          }
          executeSql('UPDATE orders SET status = ?, inventory_deducted = 1, updated_at = ? WHERE id = ?', [
            status,
            now,
            order.id,
          ]);
        } else if (wasDeducted && !shouldBeDeducted) {
          // Return stock on cancellation
          for (const it of items) {
            const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [it.product_id]);
            if (product) {
              const newStock = product.stock_quantity + it.quantity;
              executeSql('UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?', [
                newStock,
                now,
                product.id,
              ]);
              executeSql(
                `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at)
                 VALUES (?, ?, 'return', ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  generateId('mov'),
                  product.id,
                  it.quantity,
                  product.stock_quantity,
                  newStock,
                  order.order_number,
                  `بازگشت موجودی بابت لغو فاکتور ${order.order_number}`,
                  req.user?.name || 'Admin',
                  order.is_demo,
                  now,
                ]
              );
            }
          }
          executeSql('UPDATE orders SET status = ?, inventory_deducted = 0, updated_at = ? WHERE id = ?', [
            status,
            now,
            order.id,
          ]);
        } else {
          executeSql('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, now, order.id]);
        }
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // =========================================================================
  // 7. PAYMENTS & CUSTOMER DEBTS ROUTES
  // =========================================================================
  app.get('/api/payments', requireAuth, (req: Request, res: Response) => {
    const includeDemo = req.query.includeDemo !== 'false';
    const demoClause = includeDemo ? '' : 'WHERE p.is_demo = 0';
    const rows = queryAll<any>(
      `SELECT p.*,
              COALESCE(c.name, 'مشتری حضوری (نقدی)') as customer_name,
              COALESCE(c.code, 'WALK-IN') as customer_code,
              o.order_number
       FROM payments p
       LEFT JOIN customers c ON c.id = p.customer_id
       LEFT JOIN orders o ON o.id = p.order_id
       ${demoClause}
       ORDER BY p.payment_date DESC, p.created_at DESC`
    ).map((p) => ({
      ...p,
      amount: fromCents(p.amount_cents),
    }));

    // Also include overdue orders with remaining balance
    const todayStr = new Date().toISOString().slice(0, 10);
    const openOrders = queryAll<any>(
      `SELECT o.*, COALESCE(c.name, 'مشتری حضوری') as customer_name, c.phone as customer_phone
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.status != 'cancelled' ${includeDemo ? '' : 'AND o.is_demo = 0'}
       ORDER BY o.due_date ASC`
    )
      .map((o) => {
        const fin = computeOrderFinancials(o);
        return {
          ...o,
          final_total: fromCents(o.final_total_cents),
          amount_paid: fromCents(fin.netPaidCents),
          outstanding_balance: fromCents(fin.outstandingCents),
          is_overdue: Boolean(o.due_date && o.due_date < todayStr && fin.outstandingCents > 0),
        };
      })
      .filter((o) => o.outstanding_balance > 0);

    res.json({ payments: rows, openOrders });
  });

  app.post('/api/payments', requireAuth, (req: Request, res: Response) => {
    const {
      customer_id,
      order_id,
      payment_date,
      amount,
      payment_type,
      payment_method,
      reference_number,
      notes,
    } = req.body;

    const amountCents = toCents(amount);
    if (!customer_id || amountCents <= 0) {
      res.status(400).json({ error: 'انتخاب مشتری و وارد کردن مبلغ معتبر (به تومان) الزامی است.' });
      return;
    }

    const customer = queryOne<any>('SELECT * FROM customers WHERE id = ?', [customer_id]);
    if (!customer) {
      res.status(404).json({ error: 'مشتری یافت نشد.' });
      return;
    }

    const countRow = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM payments');
    const paymentNumber = `REC-1404-${501 + (countRow?.cnt || 0)}`;
    const id = generateId('pay');
    const now = new Date().toISOString();

    executeSql(
      `INSERT INTO payments (id, payment_number, customer_id, order_id, payment_date, amount_cents, payment_type, payment_method, reference_number, notes, provider_confirmed, recorded_by, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?)`,
      [
        id,
        paymentNumber,
        customer_id,
        order_id || null,
        payment_date || now.slice(0, 10),
        amountCents,
        payment_type || 'collection',
        payment_method || 'card',
        String(reference_number || '').trim(),
        String(notes || '').trim(),
        req.user?.name || 'Admin',
        now,
      ]
    );

    const updatedLedger = computeCustomerLedgerSummary(customer_id, true);
    res.status(201).json({
      id,
      payment_number: paymentNumber,
      new_balance: updatedLedger.outstandingBalance,
    });
  });

  // =========================================================================
  // 8. SIMPLE SALES REPORTS ROUTE
  // =========================================================================
  app.get('/api/reports', requireAuth, (req: Request, res: Response) => {
    const includeDemo = req.query.includeDemo !== 'false';
    const startDate = String(req.query.startDate || '2000-01-01');
    const endDate = String(req.query.endDate || '2099-12-31');
    const demoFilter = includeDemo ? '' : 'AND o.is_demo = 0';

    const orders = queryAll<any>(
      `SELECT o.*, COALESCE(c.name, 'مشتری حضوری (نقدی)') as customer_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.order_date >= ? AND o.order_date <= ? AND o.status != 'cancelled' ${demoFilter}
       ORDER BY o.order_date DESC`,
      [startDate, endDate]
    );

    let totalSalesCents = 0;
    let retailSalesCents = 0;
    let retailOrdersCount = 0;
    let wholesaleSalesCents = 0;
    let wholesaleOrdersCount = 0;

    for (const o of orders) {
      totalSalesCents += o.final_total_cents;
      if (o.pricing_type === 'wholesale') {
        wholesaleSalesCents += o.final_total_cents;
        wholesaleOrdersCount += 1;
      } else {
        retailSalesCents += o.final_total_cents;
        retailOrdersCount += 1;
      }
    }

    // Payments received in period
    const payments = queryAll<any>(
      `SELECT * FROM payments
       WHERE payment_date >= ? AND payment_date <= ? AND provider_confirmed = 1 ${
         includeDemo ? '' : 'AND is_demo = 0'
       }`,
      [startDate, endDate]
    );
    let totalReceivedCents = 0;
    for (const p of payments) {
      if (p.payment_type !== 'refund') {
        totalReceivedCents += p.amount_cents;
      } else {
        totalReceivedCents -= p.amount_cents;
      }
    }

    // Outstanding customer debts
    const customers = queryAll<any>(
      `SELECT * FROM customers WHERE status = 'active' ${includeDemo ? '' : 'AND is_demo = 0'}`
    );
    let totalDebtsCents = 0;
    for (const c of customers) {
      const sum = computeCustomerLedgerSummary(c.id, includeDemo);
      if (sum.outstandingBalance > 0) {
        totalDebtsCents += toCents(sum.outstandingBalance);
      }
    }

    // Best-selling products & Estimated profit (only when purchase cost > 0)
    const productStats = queryAll<any>(
      `SELECT
         p.id, p.sku, p.name, p.name_fa, p.category, p.unit,
         p.cost_price_cents, p.sale_price_cents, p.wholesale_price_cents, p.stock_quantity,
         COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) as units_sold,
         COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.line_total_cents ELSE 0 END), 0) as revenue_cents,
         COALESCE(SUM(CASE WHEN o.id IS NOT NULL AND oi.unit_cost_cents > 0 THEN oi.quantity * oi.unit_cost_cents ELSE 0 END), 0) as cogs_cents,
         COALESCE(SUM(CASE WHEN o.id IS NOT NULL AND oi.unit_cost_cents > 0 THEN oi.line_total_cents - (oi.quantity * oi.unit_cost_cents) ELSE 0 END), 0) as profit_cents
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled' AND o.order_date >= ? AND o.order_date <= ? ${
         includeDemo ? '' : 'AND o.is_demo = 0'
       }
       WHERE p.status = 'active' ${includeDemo ? '' : 'AND p.is_demo = 0'}
       GROUP BY p.id
       ORDER BY revenue_cents DESC`,
      [startDate, endDate]
    ).map((p) => ({
      ...p,
      cost_price: fromCents(p.cost_price_cents),
      sale_price: fromCents(p.sale_price_cents),
      wholesale_price: fromCents(p.wholesale_price_cents),
      revenue: fromCents(p.revenue_cents),
      has_cost: p.cost_price_cents > 0,
      estimated_profit: p.cost_price_cents > 0 ? fromCents(p.profit_cents) : null,
    }));

    const totalEstimatedProfitCents = productStats.reduce(
      (s, p) => s + (p.has_cost ? toCents(p.estimated_profit || 0) : 0),
      0
    );

    // Group sales by Day, Week, and Month
    const byDayMap = new Map<string, { period: string; count: number; total: number }>();
    const byMonthMap = new Map<string, { period: string; count: number; total: number }>();

    for (const o of orders) {
      const dayKey = o.order_date;
      const monthKey = o.order_date.slice(0, 7);

      const dEntry = byDayMap.get(dayKey) || { period: dayKey, count: 0, total: 0 };
      dEntry.count += 1;
      dEntry.total += fromCents(o.final_total_cents);
      byDayMap.set(dayKey, dEntry);

      const mEntry = byMonthMap.get(monthKey) || { period: monthKey, count: 0, total: 0 };
      mEntry.count += 1;
      mEntry.total += fromCents(o.final_total_cents);
      byMonthMap.set(monthKey, mEntry);
    }

    res.json({
      summary: {
        totalSales: fromCents(totalSalesCents),
        totalReceived: fromCents(totalReceivedCents),
        totalDebts: fromCents(totalDebtsCents),
        salesCount: orders.length,
        estimatedProfit: fromCents(totalEstimatedProfitCents),
        retailSales: fromCents(retailSalesCents),
        retailOrdersCount,
        wholesaleSales: fromCents(wholesaleSalesCents),
        wholesaleOrdersCount,
      },
      bestProducts: productStats,
      salesByDay: Array.from(byDayMap.values()).sort((a, b) => b.period.localeCompare(a.period)),
      salesByMonth: Array.from(byMonthMap.values()).sort((a, b) => b.period.localeCompare(a.period)),
      orders: orders.map((o) => {
        const fin = computeOrderFinancials(o);
        return {
          ...o,
          final_total: fromCents(o.final_total_cents),
          amount_paid: fromCents(fin.netPaidCents),
          outstanding_balance: fromCents(fin.outstandingCents),
          payment_status: fin.paymentStatus,
        };
      }),
    });
  });

  // =========================================================================
  // 9. NOTIFICATIONS & SETTINGS ROUTES
  // =========================================================================
  app.get('/api/notifications', requireAuth, (_req: Request, res: Response) => {
    const rows = queryAll<any>('SELECT * FROM notifications ORDER BY is_read ASC, created_at DESC');
    res.json({ notifications: rows });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
    executeSql('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  });

  app.post('/api/notifications/mark-all-read', requireAuth, (_req: Request, res: Response) => {
    executeSql('UPDATE notifications SET is_read = 1');
    res.json({ ok: true });
  });

  app.get('/api/settings', requireAuth, (_req: Request, res: Response) => {
    res.json({ settings: getBusinessSettings() });
  });

  app.put('/api/settings', requireAuth, (req: Request, res: Response) => {
    const current = getBusinessSettings();
    const updated = { ...current, ...req.body, currency: 'TOMAN' };
    executeSql("INSERT OR REPLACE INTO settings (key, value) VALUES ('business_config', ?)", [
      JSON.stringify(updated),
    ]);
    res.json({ settings: updated });
  });

  app.post('/api/settings/reset-demo', requireAuth, (_req: Request, res: Response) => {
    seedDemoData();
    res.json({ ok: true });
  });

  app.post('/api/settings/purge-demo', requireAuth, (_req: Request, res: Response) => {
    purgeDemoData();
    res.json({ ok: true });
  });

  // =========================================================================
  // VITE MIDDLEWARE
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shopino Full-Stack Server listening on http://localhost:${PORT}`);
  });
}

startServer();
