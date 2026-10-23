import 'dotenv/config';
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
  verifyPassword,
  hashSessionToken,
  generateId,
  toCents,
  fromCents,
  seedDemoData,
  purgeDemoData,
  createDatabaseBackup,
} from './src/server/db.ts';

const PORT = 3000;

export type UserRole = 'owner' | 'manager' | 'sales' | 'accountant' | 'inventory';

export const VALID_ROLES: readonly UserRole[] = [
  'owner',
  'manager',
  'sales',
  'accountant',
  'inventory',
] as const;

export const VALID_PAYMENT_METHODS = [
  'card',
  'cash',
  'bank_transfer',
  'online',
  'cheque',
] as const;

export const VALID_PAYMENT_TYPES = ['collection', 'advance', 'refund'] as const;

export const VALID_ORDER_STATUSES = [
  'registered',
  'preparing',
  'completed',
  'cancelled',
] as const;

export const VALID_UNITS = ['piece', 'pack', 'box', 'kg', 'meter', 'service'] as const;

export interface AuthUser {
  id: string;
  name: string;
  name_fa: string;
  email: string;
  role: UserRole;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const MAX_TOMAN_AMOUNT = 100_000_000_000; // 100 Billion Toman upper bound
const MAX_ITEM_QUANTITY = 100_000;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function resetRateLimitsForTests(): void {
  loginAttempts.clear();
}

function pruneRateLimits(now: number): void {
  if (loginAttempts.size < 200) return;
  for (const [k, v] of loginAttempts.entries()) {
    if (v.resetAt < now) {
      loginAttempts.delete(k);
    }
  }
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  pruneRateLimits(now);
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailedAttempts(key: string): void {
  loginAttempts.delete(key);
}

export function isDemoLoginAllowed(): boolean {
  if (process.env.ALLOW_DEMO_LOGIN === 'true') return true;
  if (process.env.ALLOW_DEMO_LOGIN === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

function getSessionTtlMs(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS || 24);
  const clampedHours = Number.isFinite(hours) ? Math.min(168, Math.max(1, hours)) : 24;
  return clampedHours * 3600 * 1000;
}

function parseStrictInt(
  value: unknown,
  opts: { min?: number; max?: number } = {}
): number | null {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    num = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isFinite(num) || !Number.isSafeInteger(num)) return null;
  if (opts.min !== undefined && num < opts.min) return null;
  if (opts.max !== undefined && num > opts.max) return null;
  return num;
}

function isValidDateString(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}

function generateNextCustomerCode(): string {
  const rows = queryAll<{ code: string }>('SELECT code FROM customers');
  let maxNum = 100;
  for (const r of rows) {
    const m = /^C-(\d+)$/i.exec(r.code || '');
    if (m) {
      const n = Number(m[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `C-${maxNum + 1}`;
}

function generateNextProductSku(): string {
  const rows = queryAll<{ sku: string }>('SELECT sku FROM products');
  let maxNum = 1000;
  for (const r of rows) {
    const m = /^P-(\d+)$/i.exec(r.sku || '');
    if (m) {
      const n = Number(m[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `P-${maxNum + 1}`;
}

function generateNextOrderNumber(prefix: string): string {
  const rows = queryAll<{ order_number: string }>('SELECT order_number FROM orders');
  let maxNum = 1000;
  for (const r of rows) {
    const m = /(\d+)$/.exec(r.order_number || '');
    if (m) {
      const n = Number(m[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  let candidate = `${prefix}${maxNum + 1}`;
  while (queryOne('SELECT id FROM orders WHERE order_number = ?', [candidate])) {
    maxNum += 1;
    candidate = `${prefix}${maxNum + 1}`;
  }
  return candidate;
}

function generateNextPaymentNumber(): string {
  const rows = queryAll<{ payment_number: string }>('SELECT payment_number FROM payments');
  let maxNum = 500;
  for (const r of rows) {
    const m = /(\d+)$/.exec(r.payment_number || '');
    if (m) {
      const n = Number(m[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  let candidate = `REC-1404-${maxNum + 1}`;
  while (queryOne('SELECT id FROM payments WHERE payment_number = ?', [candidate])) {
    maxNum += 1;
    candidate = `REC-1404-${maxNum + 1}`;
  }
  return candidate;
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
      String(summary).slice(0, 500),
      new Date().toISOString(),
    ]
  );
}

function getBusinessSettings(): Record<string, any> {
  const row = queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'business_config'");
  if (!row) {
    return { enableInventoryTracking: true, invoicePrefix: 'SHP-1404-', currency: 'TOMAN' };
  }
  try {
    return JSON.parse(row.value);
  } catch {
    return { enableInventoryTracking: true, invoicePrefix: 'SHP-1404-', currency: 'TOMAN' };
  }
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

export async function createApp() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (
    !sessionSecret ||
    sessionSecret.length < 32 ||
    sessionSecret === 'change-this-to-a-64-char-random-hex-secret-in-production'
  ) {
    throw new Error(
      'A strong SESSION_SECRET of at least 32 characters must be configured before starting Shopino.'
    );
  }
  await initDb();

  const app = express();
  app.disable('x-powered-by');

  // HTTP Security Headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' https://*.google.com https://*.run.app;"
    );
    next();
  });

  // Strict CORS protection and no-store cache control for API routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers.host || '';
      const allowedOrigins = new Set<string>([
        `http://${host}`,
        `https://${host}`,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]);
      if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
        allowedOrigins.add(process.env.APP_URL.replace(/\/$/, ''));
      }
      if (process.env.CORS_ALLOWED_ORIGINS) {
        for (const o of process.env.CORS_ALLOWED_ORIGINS.split(',')) {
          if (o.trim()) allowedOrigins.add(o.trim().replace(/\/$/, ''));
        }
      }

      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.has(normalizedOrigin) || normalizedOrigin.endsWith('.run.app')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      } else if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.status(403).json({ error: 'Cross-origin request forbidden.' });
        return;
      }
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '256kb' }));

  // Handle malformed JSON payloads safely without leaking stack traces
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      res.status(400).json({ error: 'فرمت درخواست (JSON) نامعتبر است.' });
      return;
    }
    if (err && err.type === 'entity.too.large') {
      res.status(413).json({ error: 'حجم داده‌های ارسالی بیش از حد مجاز است.' });
      return;
    }
    next(err);
  });

  // Auth Middleware (supports HMAC-SHA256 hashed tokens + legacy tokens for live continuity)
  app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const rawToken = authHeader.slice(7).trim();
      if (rawToken.length >= 16 && rawToken.length <= 256) {
        const hashedToken = hashSessionToken(rawToken);
        const session = queryOne<{ token: string; user_id: string; expires_at: string }>(
          'SELECT token, user_id, expires_at FROM sessions WHERE token = ? OR token = ?',
          [hashedToken, rawToken]
        );
        if (session) {
          if (new Date(session.expires_at) > new Date()) {
            const user = queryOne<AuthUser>(
              'SELECT id, name, name_fa, email, role, status FROM users WHERE id = ?',
              [session.user_id]
            );
            if (user && user.status === 'active' && VALID_ROLES.includes(user.role)) {
              req.user = user;
            }
          } else {
            // Clean up expired session token
            executeSql('DELETE FROM sessions WHERE token = ?', [session.token]);
          }
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

  const requireRole = (...allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required. Please log in.' });
        return;
      }
      if (!allowedRoles.includes(req.user.role)) {
        logAudit(
          req.user,
          'FORBIDDEN',
          'endpoint',
          `${req.method} ${req.path}`,
          `Role ${req.user.role} denied access (requires: ${allowedRoles.join(', ')})`
        );
        res.status(403).json({
          error: 'شما سطح دسترسی لازم برای انجام این عملیات را ندارید.',
        });
        return;
      }
      next();
    };
  };

  // =========================================================================
  // 1. AUTHENTICATION & PROFILE ROUTES
  // =========================================================================
  app.get('/api/auth/config', (_req: Request, res: Response) => {
    res.json({
      allowDemoLogin: isDemoLoginAllowed(),
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const ip = req.ip || 'local';
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!rawEmail || !rawPassword) {
      res.status(400).json({ error: 'ایمیل و رمز عبور الزامی است.' });
      return;
    }

    const ipKey = `ip:${ip}`;
    const emailKey = `email:${rawEmail}`;

    if (isRateLimited(ipKey) || isRateLimited(emailKey)) {
      res.status(429).json({
        error: 'تعداد تلاش‌های ناموفق ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر تلاش کنید.',
      });
      return;
    }

    const user = queryOne<AuthUser & { password_hash: string }>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
      [rawEmail]
    );

    if (!user || user.status !== 'active') {
      recordFailedAttempt(ipKey);
      recordFailedAttempt(emailKey);
      res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است.' });
      return;
    }

    const verification = verifyPassword(rawPassword, user.password_hash);
    if (!verification.valid) {
      recordFailedAttempt(ipKey);
      recordFailedAttempt(emailKey);
      logAudit(undefined, 'LOGIN_FAILED', 'user', user.id, `Failed login attempt for ${user.email}`);
      res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است.' });
      return;
    }

    clearFailedAttempts(ipKey);
    clearFailedAttempts(emailKey);

    if (verification.needsRehash) {
      executeSql('UPDATE users SET password_hash = ? WHERE id = ?', [
        hashPassword(rawPassword),
        user.id,
      ]);
    }

    const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
    const hashedToken = hashSessionToken(token);
    const now = new Date();
    const expires = new Date(now.getTime() + getSessionTtlMs());

    executeSql('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [
      hashedToken,
      user.id,
      expires.toISOString(),
      now.toISOString(),
    ]);
    executeSql('UPDATE users SET last_login = ? WHERE id = ?', [now.toISOString(), user.id]);
    logAudit(user, 'LOGIN', 'session', user.id, `User ${user.email} logged in`);

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
    if (!isDemoLoginAllowed()) {
      res.status(403).json({
        error: 'ورود بدون رمز به حساب‌های نمونه در محیط عملیاتی (Production) غیرفعال است.',
      });
      return;
    }

    const ip = req.ip || 'local';
    const ipKey = `demo_ip:${ip}`;
    if (isRateLimited(ipKey)) {
      res.status(429).json({ error: 'تعداد درخواست‌ها بیش از حد مجاز است.' });
      return;
    }

    const { role } = req.body || {};
    if (role !== undefined && !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: 'نقش کاربری انتخاب‌شده نامعتبر است.' });
      return;
    }
    const targetRole: UserRole = role && VALID_ROLES.includes(role) ? role : 'owner';

    const user = queryOne<AuthUser>(
      "SELECT id, name, name_fa, email, role, status FROM users WHERE role = ? AND status = 'active' LIMIT 1",
      [targetRole]
    );
    if (!user) {
      res.status(404).json({ error: 'کاربر نمونه یافت نشد.' });
      return;
    }

    const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
    const hashedToken = hashSessionToken(token);
    const now = new Date();
    const expires = new Date(now.getTime() + getSessionTtlMs());

    executeSql('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [
      hashedToken,
      user.id,
      expires.toISOString(),
      now.toISOString(),
    ]);
    logAudit(user, 'DEMO_LOGIN', 'session', user.id, `Demo session started as role ${targetRole}`);

    res.json({ token, user });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const rawToken = authHeader.slice(7).trim();
      const hashedToken = hashSessionToken(rawToken);
      executeSql('DELETE FROM sessions WHERE token = ? OR token = ?', [hashedToken, rawToken]);
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
      allowDemoLogin: isDemoLoginAllowed(),
      unreadNotificationsCount: unreadNotifs?.cnt || 0,
    });
  });

  app.put('/api/auth/profile', requireAuth, (req: Request, res: Response) => {
    if (!req.user) return;

    // Prevent privilege escalation attempts if client sends role or status in body
    if (
      (req.body?.role !== undefined && req.body.role !== req.user.role) ||
      (req.body?.status !== undefined && req.body.status !== req.user.status)
    ) {
      logAudit(req.user, 'PRIVILEGE_ESCALATION_ATTEMPT', 'user', req.user.id, 'Attempted to modify role/status via profile');
      res.status(403).json({ error: 'تغییر نقش کاربری یا وضعیت حساب از این طریق مجاز نیست.' });
      return;
    }

    const { name, name_fa, email, currentPassword, newPassword } = req.body || {};

    const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : req.user.name;
    const cleanNameFa =
      typeof name_fa === 'string' && name_fa.trim()
        ? name_fa.trim().slice(0, 120)
        : cleanName || req.user.name_fa;
    const cleanEmail =
      typeof email === 'string' && email.trim()
        ? email.trim().toLowerCase().slice(0, 160)
        : req.user.email.toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'فرمت ایمیل واردشده معتبر نیست.' });
      return;
    }

    const emailChanged = cleanEmail.toLowerCase() !== req.user.email.toLowerCase();
    const wantsPasswordChange = typeof newPassword === 'string' && newPassword.trim().length > 0;

    if (emailChanged) {
      const duplicate = queryOne<{ id: string }>(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?',
        [cleanEmail, req.user.id]
      );
      if (duplicate) {
        res.status(409).json({ error: 'این ایمیل قبلاً برای کاربر دیگری ثبت شده است.' });
        return;
      }
    }

    if (wantsPasswordChange || emailChanged) {
      if (typeof currentPassword !== 'string' || !currentPassword) {
        res.status(400).json({
          error: 'برای تغییر رمز عبور یا ایمیل، وارد کردن رمز عبور فعلی الزامی است.',
        });
        return;
      }
      const dbUser = queryOne<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = ?',
        [req.user.id]
      );
      if (!dbUser || !verifyPassword(currentPassword, dbUser.password_hash).valid) {
        res.status(401).json({ error: 'رمز عبور فعلی اشتباه است.' });
        return;
      }
    }

    if (wantsPasswordChange) {
      const trimmedNew = String(newPassword).trim();
      if (trimmedNew.length < 8 || trimmedNew.length > 128) {
        res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.' });
        return;
      }
      const newHash = hashPassword(trimmedNew);
      executeSql('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

      // Invalidate all other sessions for this user
      const authHeader = req.headers.authorization;
      const currentRawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const currentHashedToken = currentRawToken ? hashSessionToken(currentRawToken) : '';
      executeSql('DELETE FROM sessions WHERE user_id = ? AND token != ? AND token != ?', [
        req.user.id,
        currentHashedToken,
        currentRawToken,
      ]);
      logAudit(req.user, 'PASSWORD_CHANGE', 'user', req.user.id, `Password updated for ${cleanEmail}`);
    }

    executeSql('UPDATE users SET name = ?, name_fa = ?, email = ? WHERE id = ?', [
      cleanName,
      cleanNameFa,
      cleanEmail,
      req.user.id,
    ]);
    logAudit(req.user, 'PROFILE_UPDATE', 'user', req.user.id, `Updated profile for ${cleanEmail}`);

    res.json({ ok: true });
  });

  // =========================================================================
  // 2. GLOBAL SEARCH
  // =========================================================================
  app.get(
    '/api/search',
    requireRole('owner', 'manager', 'sales', 'accountant', 'inventory'),
    (req: Request, res: Response) => {
      const q = String(req.query.q || '').trim().slice(0, 100);
      if (!q) {
        res.json({ customers: [], orders: [], products: [] });
        return;
      }
      const like = `%${q}%`;
      const canReadCustomers = req.user?.role !== 'inventory';

      const customers = canReadCustomers
        ? queryAll(
            `SELECT id, code, name, phone, customer_type FROM customers
             WHERE name LIKE ? OR code LIKE ? OR phone LIKE ? LIMIT 5`,
            [like, like, like]
          )
        : [];

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
    }
  );

  // =========================================================================
  // 3. DASHBOARD OVERVIEW (5 Key Questions + 2 Charts + Lists)
  // =========================================================================
  app.get(
    '/api/dashboard',
    requireRole('owner', 'manager', 'sales', 'accountant', 'inventory'),
    (req: Request, res: Response) => {
      const includeDemo = req.query.includeDemo !== 'false';
      const rawStart = String(req.query.startDate || '2000-01-01');
      const rawEnd = String(req.query.endDate || '2099-12-31');
      const startDate = isValidDateString(rawStart) ? rawStart : '2000-01-01';
      const endDate = isValidDateString(rawEnd) ? rawEnd : '2099-12-31';
      const todayStr = new Date().toISOString().slice(0, 10);
      const demoFilter = includeDemo ? '' : 'AND is_demo = 0';
      const canViewCost = ['owner', 'manager', 'accountant'].includes(req.user!.role);

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
        cost_price_cents: canViewCost ? p.cost_price_cents : undefined,
        cost_price: canViewCost ? fromCents(p.cost_price_cents) : undefined,
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
          cost_total_cents: canViewCost ? o.cost_total_cents : undefined,
          final_total: fromCents(o.final_total_cents),
          amount_paid: fromCents(fin.netPaidCents),
          outstanding_balance: fromCents(fin.outstandingCents),
          payment_status: fin.paymentStatus,
        };
      });

      const debtorCustomers =
        req.user!.role === 'inventory'
          ? []
          : [...customerSummaries]
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
    }
  );

  // =========================================================================
  // 4. CUSTOMERS ROUTES
  // =========================================================================
  app.get(
    '/api/customers',
    requireRole('owner', 'manager', 'sales', 'accountant'),
    (req: Request, res: Response) => {
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
    }
  );

  app.get(
    '/api/customers/:id',
    requireRole('owner', 'manager', 'sales', 'accountant'),
    (req: Request, res: Response) => {
      const customer = queryOne<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
      if (!customer) {
        res.status(404).json({ error: 'مشتری یافت نشد.' });
        return;
      }

      const canViewCost = ['owner', 'manager', 'accountant'].includes(req.user!.role);
      const ledger = computeCustomerLedgerSummary(customer.id, true);
      const orders = queryAll<any>(
        'SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC, created_at DESC',
        [customer.id]
      ).map((o) => {
        const fin = computeOrderFinancials(o);
        return {
          ...o,
          cost_total_cents: canViewCost ? o.cost_total_cents : undefined,
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
    }
  );

  app.post(
    '/api/customers',
    requireRole('owner', 'manager', 'sales'),
    (req: Request, res: Response) => {
      const { name, phone, email, address, customer_type, tags, notes } = req.body || {};
      const cleanName = String(name || '').trim();
      if (!cleanName || cleanName.length > 150) {
        res.status(400).json({ error: 'نام مشتری الزامی است و نباید بیش از ۱۵۰ کاراکتر باشد.' });
        return;
      }

      const cleanEmail = String(email || '').trim();
      if (cleanEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 160)) {
        res.status(400).json({ error: 'فرمت ایمیل مشتری نامعتبر است.' });
        return;
      }

      const id = generateId('cust');
      const code = generateNextCustomerCode();
      const now = new Date().toISOString();

      executeSql(
        `INSERT INTO customers (id, code, name, phone, email, address, customer_type, tags, notes, status, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`,
        [
          id,
          code,
          cleanName,
          String(phone || '').trim().slice(0, 30),
          cleanEmail,
          String(address || '').trim().slice(0, 400),
          customer_type === 'wholesale' ? 'wholesale' : 'retail',
          String(tags || '').trim().slice(0, 200),
          String(notes || '').trim().slice(0, 1000),
          now,
          now,
        ]
      );

      logAudit(req.user, 'CREATE', 'customer', id, `Created customer ${cleanName} (${code})`);
      res.status(201).json({ id, code });
    }
  );

  app.put(
    '/api/customers/:id',
    requireRole('owner', 'manager', 'sales'),
    (req: Request, res: Response) => {
      const { name, phone, email, address, customer_type, tags, notes, status } = req.body || {};
      const existing = queryOne<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
      if (!existing) {
        res.status(404).json({ error: 'مشتری یافت نشد.' });
        return;
      }

      const nextName = name !== undefined ? String(name).trim() : existing.name;
      if (!nextName || nextName.length > 150) {
        res.status(400).json({ error: 'نام مشتری نمی‌تواند خالی یا بیش از ۱۵۰ کاراکتر باشد.' });
        return;
      }

      const nextEmail = email !== undefined ? String(email).trim() : existing.email;
      if (nextEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail) || nextEmail.length > 160)) {
        res.status(400).json({ error: 'فرمت ایمیل مشتری نامعتبر است.' });
        return;
      }

      const nextStatus = status !== undefined ? String(status) : existing.status;
      if (!['active', 'archived'].includes(nextStatus)) {
        res.status(400).json({ error: 'وضعیت مشتری نامعتبر است.' });
        return;
      }

      const nextType = customer_type !== undefined ? String(customer_type) : existing.customer_type;
      if (!['retail', 'wholesale'].includes(nextType)) {
        res.status(400).json({ error: 'نوع مشتری نامعتبر است.' });
        return;
      }

      const now = new Date().toISOString();
      executeSql(
        `UPDATE customers
         SET name = ?, phone = ?, email = ?, address = ?, customer_type = ?, tags = ?, notes = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [
          nextName,
          phone !== undefined ? String(phone).trim().slice(0, 30) : existing.phone,
          nextEmail,
          address !== undefined ? String(address).trim().slice(0, 400) : existing.address,
          nextType,
          tags !== undefined ? String(tags).trim().slice(0, 200) : existing.tags,
          notes !== undefined ? String(notes).trim().slice(0, 1000) : existing.notes,
          nextStatus,
          now,
          existing.id,
        ]
      );

      logAudit(req.user, 'UPDATE', 'customer', existing.id, `Updated customer ${nextName}`);
      res.json({ ok: true });
    }
  );

  app.delete(
    '/api/customers/:id',
    requireRole('owner', 'manager'),
    (req: Request, res: Response) => {
      const existing = queryOne<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
      if (!existing) {
        res.status(404).json({ error: 'مشتری یافت نشد.' });
        return;
      }

      const orderCount = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM orders WHERE customer_id = ?', [
        req.params.id,
      ]);
      const paymentCount = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM payments WHERE customer_id = ?', [
        req.params.id,
      ]);
      if ((orderCount && orderCount.cnt > 0) || (paymentCount && paymentCount.cnt > 0)) {
        res.status(400).json({
          error: 'این مشتری دارای سابقه فاکتور یا پرداخت است. برای حفظ دقت حساب‌ها، به جای حذف، او را بایگانی کنید.',
        });
        return;
      }

      executeSql('DELETE FROM customer_notes WHERE customer_id = ?', [req.params.id]);
      executeSql('DELETE FROM customers WHERE id = ?', [req.params.id]);
      logAudit(req.user, 'DELETE', 'customer', existing.id, `Deleted customer ${existing.name} (${existing.code})`);
      res.json({ ok: true });
    }
  );

  // =========================================================================
  // 5. PRODUCTS & INVENTORY ROUTES
  // =========================================================================
  app.get(
    '/api/products',
    requireRole('owner', 'manager', 'sales', 'accountant', 'inventory'),
    (req: Request, res: Response) => {
      const includeDemo = req.query.includeDemo !== 'false';
      const demoClause = includeDemo ? '' : 'WHERE is_demo = 0';
      const canViewCost = ['owner', 'manager', 'accountant'].includes(req.user!.role);

      const rows = queryAll<any>(`SELECT * FROM products ${demoClause} ORDER BY created_at DESC`).map((p) => {
        const marginCents = p.sale_price_cents - p.cost_price_cents;
        const marginPercent =
          p.sale_price_cents > 0 && p.cost_price_cents > 0
            ? Math.round((marginCents / p.sale_price_cents) * 1000) / 10
            : 0;
        return {
          ...p,
          cost_price_cents: canViewCost ? p.cost_price_cents : undefined,
          cost_price: canViewCost ? fromCents(p.cost_price_cents) : undefined,
          sale_price: fromCents(p.sale_price_cents),
          wholesale_price: fromCents(p.wholesale_price_cents),
          unit_profit: canViewCost && p.cost_price_cents > 0 ? fromCents(marginCents) : null,
          margin_percent: canViewCost ? marginPercent : undefined,
        };
      });
      res.json({ products: rows });
    }
  );

  app.post(
    '/api/products',
    requireRole('owner', 'manager', 'inventory'),
    (req: Request, res: Response) => {
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
      } = req.body || {};

      const cleanName = String(name || '').trim();
      const parsedSalePrice = parseStrictInt(sale_price);
      if (!cleanName || cleanName.length > 180 || parsedSalePrice === null || parsedSalePrice < 0) {
        res.status(400).json({ error: 'نام کالا و قیمت فروش معتبر (عدد صحیح غیرمنفی) الزامی است.' });
        return;
      }

      const parsedCostPrice = cost_price === undefined || cost_price === '' ? 0 : parseStrictInt(cost_price);
      const parsedWholesalePrice =
        wholesale_price === undefined || wholesale_price === '' ? parsedSalePrice : parseStrictInt(wholesale_price);
      const parsedStock = stock_quantity === undefined || stock_quantity === '' ? 0 : parseStrictInt(stock_quantity);
      const parsedThreshold =
        min_stock_threshold === undefined || min_stock_threshold === '' ? 5 : parseStrictInt(min_stock_threshold);

      if (
        parsedCostPrice === null ||
        parsedCostPrice < 0 ||
        parsedWholesalePrice === null ||
        parsedWholesalePrice < 0 ||
        parsedStock === null ||
        parsedStock < 0 ||
        parsedThreshold === null ||
        parsedThreshold < 0
      ) {
        res.status(400).json({ error: 'مقادیر قیمت و موجودی باید اعداد صحیح غیرمنفی باشند.' });
        return;
      }

      const finalSku =
        sku && String(sku).trim() ? String(sku).trim().toUpperCase().slice(0, 50) : generateNextProductSku();

      const dupSku = queryOne<{ id: string }>('SELECT id FROM products WHERE UPPER(sku) = ?', [finalSku]);
      if (dupSku) {
        res.status(400).json({ error: 'کد کالا (SKU) واردشده تکراری است.' });
        return;
      }

      const id = generateId('prd');
      const now = new Date().toISOString();

      runTransaction(() => {
        executeSql(
          `INSERT INTO products (id, sku, name, name_fa, category, description, notes, unit, cost_price_cents, sale_price_cents, wholesale_price_cents, stock_quantity, min_stock_threshold, product_type, status, is_demo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'physical', 'active', 0, ?, ?)`,
          [
            id,
            finalSku,
            cleanName,
            String(name_fa || cleanName).trim().slice(0, 180),
            String(category || 'عمومی').trim().slice(0, 100),
            String(notes || '').trim().slice(0, 1000),
            String(notes || '').trim().slice(0, 1000),
            String(unit || 'piece').trim().slice(0, 40),
            parsedCostPrice,
            parsedSalePrice,
            parsedWholesalePrice,
            parsedStock,
            parsedThreshold,
            now,
            now,
          ]
        );

        if (parsedStock > 0) {
          executeSql(
            `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at)
             VALUES (?, ?, 'addition', ?, 0, ?, 'INIT', 'موجودی اولیه هنگام تعریف کالا', ?, 0, ?)`,
            [generateId('mov'), id, parsedStock, parsedStock, req.user?.name || 'Admin', now]
          );
        }
      });

      logAudit(req.user, 'CREATE', 'product', id, `Created product ${cleanName} (${finalSku})`);
      res.status(201).json({ id, sku: finalSku });
    }
  );

  app.put(
    '/api/products/:id',
    requireRole('owner', 'manager', 'inventory'),
    (req: Request, res: Response) => {
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
      } = req.body || {};

      const nextName = name !== undefined ? String(name).trim() : existing.name;
      if (!nextName || nextName.length > 180) {
        res.status(400).json({ error: 'نام کالا نمی‌تواند خالی باشد.' });
        return;
      }

      const nextSku = sku !== undefined ? String(sku).trim().toUpperCase().slice(0, 50) : existing.sku;
      if (!nextSku) {
        res.status(400).json({ error: 'کد کالا (SKU) نمی‌تواند خالی باشد.' });
        return;
      }
      const dupSku = queryOne<{ id: string }>('SELECT id FROM products WHERE UPPER(sku) = ? AND id != ?', [
        nextSku,
        existing.id,
      ]);
      if (dupSku) {
        res.status(400).json({ error: 'کد کالا (SKU) واردشده متعلق به کالای دیگری است.' });
        return;
      }

      const nextCost = cost_price !== undefined ? parseStrictInt(cost_price) : existing.cost_price_cents;
      const nextSale = sale_price !== undefined ? parseStrictInt(sale_price) : existing.sale_price_cents;
      const nextWholesale =
        wholesale_price !== undefined ? parseStrictInt(wholesale_price) : existing.wholesale_price_cents;
      const nextThreshold =
        min_stock_threshold !== undefined ? parseStrictInt(min_stock_threshold) : existing.min_stock_threshold;

      if (
        nextCost === null ||
        nextCost < 0 ||
        nextSale === null ||
        nextSale < 0 ||
        nextWholesale === null ||
        nextWholesale < 0 ||
        nextThreshold === null ||
        nextThreshold < 0
      ) {
        res.status(400).json({ error: 'مقادیر قیمت و حد هشدار موجودی باید اعداد صحیح غیرمنفی باشند.' });
        return;
      }

      const nextStatus = status !== undefined ? String(status) : existing.status;
      if (!['active', 'archived'].includes(nextStatus)) {
        res.status(400).json({ error: 'وضعیت کالا نامعتبر است.' });
        return;
      }

      const now = new Date().toISOString();

      executeSql(
        `UPDATE products
         SET sku = ?, name = ?, name_fa = ?, category = ?, description = ?, notes = ?, unit = ?,
             cost_price_cents = ?, sale_price_cents = ?, wholesale_price_cents = ?,
             min_stock_threshold = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [
          nextSku,
          nextName,
          name_fa !== undefined ? String(name_fa).trim().slice(0, 180) : nextName,
          category !== undefined ? String(category).trim().slice(0, 100) : existing.category,
          notes !== undefined ? String(notes).trim().slice(0, 1000) : existing.description,
          notes !== undefined ? String(notes).trim().slice(0, 1000) : existing.notes,
          unit !== undefined ? String(unit).trim().slice(0, 40) : existing.unit,
          nextCost,
          nextSale,
          nextWholesale,
          nextThreshold,
          nextStatus,
          now,
          existing.id,
        ]
      );

      logAudit(req.user, 'UPDATE', 'product', existing.id, `Updated product ${nextName} (${nextSku})`);
      res.json({ ok: true });
    }
  );

  app.get(
    '/api/inventory/movements',
    requireRole('owner', 'manager', 'inventory', 'accountant'),
    (req: Request, res: Response) => {
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
    }
  );

  app.post(
    '/api/inventory/adjust',
    requireRole('owner', 'manager', 'inventory'),
    (req: Request, res: Response) => {
      const { product_id, movement_type, quantity_change, reason } = req.body || {};
      const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [product_id]);
      if (!product) {
        res.status(404).json({ error: 'کالا یافت نشد.' });
        return;
      }

      const delta = parseStrictInt(quantity_change);
      if (delta === null || delta === 0 || Math.abs(delta) > 1_000_000) {
        res.status(400).json({ error: 'مقدار تغییر موجودی باید یک عدد صحیح غیرصفر و معتبر باشد.' });
        return;
      }

      const validTypes = ['addition', 'reduction', 'correction', 'damage', 'return'];
      const effectiveType =
        movement_type && validTypes.includes(String(movement_type))
          ? String(movement_type)
          : delta > 0
            ? 'addition'
            : 'reduction';

      const newStock = product.stock_quantity + delta;
      if (newStock < 0) {
        res.status(400).json({
          error: `موجودی انبار نمی‌تواند منفی شود. موجودی فعلی: ${product.stock_quantity}`,
        });
        return;
      }

      const now = new Date().toISOString();
      const cleanReason = String(reason || 'اصلاح دستی موجودی').trim().slice(0, 500);

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
            effectiveType,
            delta,
            product.stock_quantity,
            newStock,
            cleanReason,
            req.user?.name || 'Admin',
            now,
          ]
        );
      });

      logAudit(
        req.user,
        'INVENTORY_ADJUST',
        'product',
        product.id,
        `Adjusted stock for ${product.sku} by ${delta} (new: ${newStock})`
      );
      res.json({ ok: true, new_stock: newStock });
    }
  );

  // =========================================================================
  // 6. FAST SALES & ORDERS ROUTES
  // =========================================================================
  app.get(
    '/api/orders',
    requireRole('owner', 'manager', 'sales', 'accountant', 'inventory'),
    (req: Request, res: Response) => {
      const includeDemo = req.query.includeDemo !== 'false';
      const demoClause = includeDemo ? '' : 'WHERE o.is_demo = 0';
      const canViewCost = ['owner', 'manager', 'accountant'].includes(req.user!.role);

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
          unit_cost_cents: canViewCost ? it.unit_cost_cents : undefined,
          unit_price: fromCents(it.unit_price_cents),
          unit_cost: canViewCost ? fromCents(it.unit_cost_cents) : undefined,
          discount: fromCents(it.discount_cents),
          line_total: fromCents(it.line_total_cents),
        }));

        return {
          ...o,
          cost_total_cents: canViewCost ? o.cost_total_cents : undefined,
          subtotal: fromCents(o.subtotal_cents),
          item_discount: fromCents(o.item_discount_cents),
          order_discount: fromCents(o.order_discount_cents),
          tax: fromCents(o.tax_cents),
          final_total: fromCents(o.final_total_cents),
          cost_total: canViewCost ? fromCents(o.cost_total_cents) : undefined,
          amount_paid: fromCents(fin.netPaidCents),
          outstanding_balance: fromCents(fin.outstandingCents),
          payment_status: fin.paymentStatus,
          items,
        };
      });

      res.json({ orders: enriched });
    }
  );

  app.get(
    '/api/orders/:id',
    requireRole('owner', 'manager', 'sales', 'accountant', 'inventory'),
    (req: Request, res: Response) => {
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

      const canViewCost = ['owner', 'manager', 'accountant'].includes(req.user!.role);
      const fin = computeOrderFinancials(order);
      const items = queryAll<any>('SELECT * FROM order_items WHERE order_id = ?', [order.id]).map((it) => ({
        ...it,
        unit_cost_cents: canViewCost ? it.unit_cost_cents : undefined,
        unit_price: fromCents(it.unit_price_cents),
        unit_cost: canViewCost ? fromCents(it.unit_cost_cents) : undefined,
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
          cost_total_cents: canViewCost ? order.cost_total_cents : undefined,
          subtotal: fromCents(order.subtotal_cents),
          item_discount: fromCents(order.item_discount_cents),
          order_discount: fromCents(order.order_discount_cents),
          tax: fromCents(order.tax_cents),
          final_total: fromCents(order.final_total_cents),
          cost_total: canViewCost ? fromCents(order.cost_total_cents) : undefined,
          amount_paid: fromCents(fin.netPaidCents),
          outstanding_balance: fromCents(fin.outstandingCents),
          payment_status: fin.paymentStatus,
        },
        items,
        payments,
      });
    }
  );

  app.post(
    '/api/orders',
    requireRole('owner', 'manager', 'sales'),
    (req: Request, res: Response) => {
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
      } = req.body || {};

      if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
        res.status(400).json({ error: 'فاکتور باید شامل حداقل ۱ و حداکثر ۱۰۰ ردیف کالا باشد.' });
        return;
      }

      const validStatuses = ['registered', 'preparing', 'completed', 'cancelled'];
      const orderStatus = status ? String(status) : 'completed';
      if (!validStatuses.includes(orderStatus)) {
        res.status(400).json({ error: 'وضعیت فاکتور نامعتبر است.' });
        return;
      }

      const effectivePricingType = pricing_type === 'wholesale' ? 'wholesale' : 'retail';

      const normalizedCustomerId =
        customer_id && String(customer_id).trim() && customer_id !== 'walk-in' ? String(customer_id).trim() : null;

      if (normalizedCustomerId) {
        const customer = queryOne<any>('SELECT * FROM customers WHERE id = ?', [normalizedCustomerId]);
        if (!customer) {
          res.status(404).json({ error: 'مشتری انتخاب‌شده یافت نشد.' });
          return;
        }
        if (customer.status === 'archived') {
          res.status(400).json({ error: 'امکان ثبت فاکتور جدید برای مشتری بایگانی‌شده وجود ندارد.' });
          return;
        }
      }

      const parsedOrderDisc =
        order_discount === undefined || order_discount === '' ? 0 : parseStrictInt(order_discount);
      if (parsedOrderDisc === null || parsedOrderDisc < 0) {
        res.status(400).json({ error: 'مبلغ تخفیف کلی فاکتور نامعتبر است.' });
        return;
      }

      const parsedInitPay =
        initial_payment_amount === undefined || initial_payment_amount === ''
          ? 0
          : parseStrictInt(initial_payment_amount);
      if (parsedInitPay === null || parsedInitPay < 0) {
        res.status(400).json({ error: 'مبلغ دریافتی اولیه نامعتبر است.' });
        return;
      }

      const validPayMethods = ['cash', 'card', 'transfer', 'bank_transfer', 'online', 'cheque'];
      const effectivePayMethod =
        initial_payment_method && validPayMethods.includes(String(initial_payment_method))
          ? String(initial_payment_method)
          : 'card';

      const now = new Date().toISOString();
      const orderDateStr =
        order_date && isValidDateString(String(order_date)) ? String(order_date) : now.slice(0, 10);
      const dueDateStr = due_date && isValidDateString(String(due_date)) ? String(due_date) : orderDateStr;

      const shouldDeductStock = orderStatus !== 'cancelled' && isInventoryTrackingEnabled();
      const settings = getBusinessSettings();
      const prefix = settings.invoicePrefix || 'SHP-1404-';

      try {
        const result = runTransaction(() => {
          const orderNumber = generateNextOrderNumber(prefix);
          const orderId = generateId('ord');
          let subtotalCents = 0;
          let itemDiscountCents = 0;
          let costTotalCents = 0;

          for (const line of items) {
            if (!line || typeof line !== 'object' || !line.product_id) {
              throw new Error('اطلاعات ردیف کالا ناقص است.');
            }
            const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [String(line.product_id)]);
            if (!product || product.status === 'archived') {
              throw new Error('کالای انتخاب‌شده یافت نشد یا غیرفعال است.');
            }

            const qty = parseStrictInt(line.quantity);
            if (qty === null || qty < 1 || qty > 1_000_000) {
              throw new Error(`تعداد کالای «${product.name}» باید یک عدد صحیح مثبت باشد.`);
            }

            const lineDisc =
              line.discount === undefined || line.discount === '' ? 0 : parseStrictInt(line.discount);
            if (lineDisc === null || lineDisc < 0) {
              throw new Error(`تخفیف ردیف کالای «${product.name}» نامعتبر است.`);
            }

            if (shouldDeductStock && product.stock_quantity < qty) {
              throw new Error(
                `موجودی کالای «${product.name}» کافی نیست. موجودی فعلی: ${product.stock_quantity}، تعداد درخواستی: ${qty}`
              );
            }

            // Authoritative server-side catalog pricing (never trust client-supplied unit_price)
            const authoritativeUnitPriceCents =
              effectivePricingType === 'wholesale' && product.wholesale_price_cents > 0
                ? product.wholesale_price_cents
                : product.sale_price_cents;

            const lineGrossCents = authoritativeUnitPriceCents * qty;
            if (lineDisc > lineGrossCents) {
              throw new Error(`تخفیف ردیف کالای «${product.name}» نمی‌تواند بیشتر از مبلغ کل ردیف باشد.`);
            }
            const lineTotalCents = lineGrossCents - lineDisc;

            subtotalCents += lineGrossCents;
            itemDiscountCents += lineDisc;
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
                authoritativeUnitPriceCents,
                product.cost_price_cents,
                lineDisc,
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

          const netAfterItemDiscCents = subtotalCents - itemDiscountCents;
          if (parsedOrderDisc > netAfterItemDiscCents) {
            throw new Error('تخفیف کلی فاکتور نمی‌تواند بیشتر از جمع کل فاکتور پس از تخفیف ردیف‌ها باشد.');
          }
          const finalTotalCents = netAfterItemDiscCents - parsedOrderDisc;

          if (parsedInitPay > finalTotalCents) {
            throw new Error('مبلغ دریافتی اولیه نمی‌تواند بیشتر از مبلغ قابل پرداخت فاکتور باشد.');
          }

          // Anonymous walk-in sales cannot remain unpaid on credit without a customer account
          if (!normalizedCustomerId && parsedInitPay < finalTotalCents && orderStatus !== 'cancelled') {
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
              effectivePricingType,
              orderDateStr,
              dueDateStr,
              orderStatus,
              subtotalCents,
              itemDiscountCents,
              parsedOrderDisc,
              finalTotalCents,
              costTotalCents,
              String(notes || '').trim().slice(0, 1000),
              shouldDeductStock ? 1 : 0,
              req.user?.name || 'Admin',
              now,
              now,
            ]
          );

          if (parsedInitPay > 0 && orderStatus !== 'cancelled') {
            const payNumber = generateNextPaymentNumber();
            executeSql(
              `INSERT INTO payments (id, payment_number, customer_id, order_id, payment_date, amount_cents, payment_type, payment_method, reference_number, notes, provider_confirmed, recorded_by, is_demo, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'collection', ?, ?, ?, 1, ?, 0, ?)`,
              [
                generateId('pay'),
                payNumber,
                normalizedCustomerId,
                orderId,
                orderDateStr,
                parsedInitPay,
                effectivePayMethod,
                String(initial_payment_reference || '').trim().slice(0, 100),
                `دریافت وجه هم‌زمان با ثبت فاکتور ${orderNumber}`,
                req.user?.name || 'Admin',
                now,
              ]
            );
          }

          return { id: orderId, order_number: orderNumber, final_total: fromCents(finalTotalCents) };
        });

        logAudit(
          req.user,
          'CREATE',
          'order',
          result.id,
          `Created order ${result.order_number} (total: ${result.final_total} Toman)`
        );
        res.status(201).json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'خطا در ثبت فاکتور' });
      }
    }
  );

  app.patch(
    '/api/orders/:id/status',
    requireRole('owner', 'manager', 'sales', 'inventory'),
    (req: Request, res: Response) => {
      const { status } = req.body || {};
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

        logAudit(
          req.user,
          'STATUS_CHANGE',
          'order',
          order.id,
          `Order ${order.order_number} status changed from ${order.status} to ${status}`
        );
        res.json({ ok: true });
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  // =========================================================================
  // 7. PAYMENTS & CUSTOMER DEBTS ROUTES
  // =========================================================================
  app.get(
    '/api/payments',
    requireRole('owner', 'manager', 'sales', 'accountant'),
    (req: Request, res: Response) => {
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
    }
  );

  app.post(
    '/api/payments',
    requireRole('owner', 'manager', 'sales', 'accountant'),
    (req: Request, res: Response) => {
      const {
        customer_id,
        order_id,
        payment_date,
        amount,
        payment_type,
        payment_method,
        reference_number,
        notes,
      } = req.body || {};

      const amountCents = parseStrictInt(amount);
      if (!customer_id || amountCents === null || amountCents <= 0 || amountCents > 100_000_000_000) {
        res.status(400).json({ error: 'انتخاب مشتری و وارد کردن مبلغ صحیح و مثبت (به تومان) الزامی است.' });
        return;
      }

      const customer = queryOne<any>('SELECT * FROM customers WHERE id = ?', [String(customer_id)]);
      if (!customer) {
        res.status(404).json({ error: 'مشتری یافت نشد.' });
        return;
      }

      const validTypes = ['collection', 'advance', 'refund'];
      const effectiveType =
        payment_type && validTypes.includes(String(payment_type)) ? String(payment_type) : 'collection';

      const validMethods = ['cash', 'card', 'transfer', 'bank_transfer', 'online', 'cheque'];
      const effectiveMethod =
        payment_method && validMethods.includes(String(payment_method)) ? String(payment_method) : 'card';

      const normalizedOrderId = order_id && String(order_id).trim() ? String(order_id).trim() : null;
      if (normalizedOrderId) {
        const order = queryOne<any>('SELECT * FROM orders WHERE id = ?', [normalizedOrderId]);
        if (!order) {
          res.status(404).json({ error: 'فاکتور انتخاب‌شده یافت نشد.' });
          return;
        }
        if (order.customer_id && order.customer_id !== customer.id) {
          res.status(400).json({ error: 'فاکتور انتخاب‌شده متعلق به این مشتری نیست.' });
          return;
        }
        if (order.status === 'cancelled' && effectiveType !== 'refund') {
          res.status(400).json({ error: 'امکان ثبت دریافت برای فاکتور لغوشده وجود ندارد.' });
          return;
        }
        const fin = computeOrderFinancials(order);
        if (effectiveType === 'collection' && amountCents > fin.outstandingCents) {
          res.status(400).json({
            error: `مبلغ دریافتی (${amountCents} تومان) بیشتر از مانده بدهی فاکتور (${fin.outstandingCents} تومان) است.`,
          });
          return;
        }
      }

      // Guard against accidental double-submission within 5 seconds
      const fiveSecAgo = new Date(Date.now() - 5000).toISOString();
      const cleanRef = String(reference_number || '').trim().slice(0, 100);
      const duplicatePayment = queryOne<{ id: string }>(
        `SELECT id FROM payments
         WHERE customer_id = ?
           AND COALESCE(order_id, '') = ?
           AND amount_cents = ?
           AND payment_type = ?
           AND payment_method = ?
           AND reference_number = ?
           AND created_at >= ?`,
        [customer.id, normalizedOrderId || '', amountCents, effectiveType, effectiveMethod, cleanRef, fiveSecAgo]
      );
      if (duplicatePayment) {
        res.status(409).json({ error: 'این دریافت همین لحظه ثبت شده است. از ثبت تکراری جلوگیری شد.' });
        return;
      }

      const now = new Date().toISOString();
      const payDateStr =
        payment_date && isValidDateString(String(payment_date)) ? String(payment_date) : now.slice(0, 10);
      const paymentNumber = generateNextPaymentNumber();
      const id = generateId('pay');

      executeSql(
        `INSERT INTO payments (id, payment_number, customer_id, order_id, payment_date, amount_cents, payment_type, payment_method, reference_number, notes, provider_confirmed, recorded_by, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?)`,
        [
          id,
          paymentNumber,
          customer.id,
          normalizedOrderId,
          payDateStr,
          amountCents,
          effectiveType,
          effectiveMethod,
          cleanRef,
          String(notes || '').trim().slice(0, 500),
          req.user?.name || 'Admin',
          now,
        ]
      );

      logAudit(
        req.user,
        'CREATE',
        'payment',
        id,
        `Recorded payment ${paymentNumber} (${amountCents} Toman) for customer ${customer.code}`
      );

      const updatedLedger = computeCustomerLedgerSummary(customer.id, true);
      res.status(201).json({
        id,
        payment_number: paymentNumber,
        new_balance: updatedLedger.outstandingBalance,
      });
    }
  );

  // =========================================================================
  // 8. SIMPLE SALES REPORTS ROUTE
  // =========================================================================
  app.get(
    '/api/reports',
    requireRole('owner', 'manager', 'accountant'),
    (req: Request, res: Response) => {
      const includeDemo = req.query.includeDemo !== 'false';
      const rawStart = String(req.query.startDate || '2000-01-01');
      const rawEnd = String(req.query.endDate || '2099-12-31');
      const startDate = isValidDateString(rawStart) ? rawStart : '2000-01-01';
      const endDate = isValidDateString(rawEnd) ? rawEnd : '2099-12-31';
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

      // Group sales by Day and Month
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
    }
  );

  // =========================================================================
  // 9. NOTIFICATIONS & SETTINGS ROUTES
  // =========================================================================
  app.get(
    '/api/notifications',
    requireRole('owner', 'manager', 'sales', 'accountant', 'inventory'),
    (_req: Request, res: Response) => {
      const rows = queryAll<any>('SELECT * FROM notifications ORDER BY is_read ASC, created_at DESC');
      res.json({ notifications: rows });
    }
  );

  app.patch(
    '/api/notifications/:id/read',
    requireRole('owner', 'manager', 'sales', 'accountant', 'inventory'),
    (req: Request, res: Response) => {
      executeSql('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    }
  );

  app.post(
    '/api/notifications/mark-all-read',
    requireRole('owner', 'manager', 'sales', 'accountant', 'inventory'),
    (_req: Request, res: Response) => {
      executeSql('UPDATE notifications SET is_read = 1');
      res.json({ ok: true });
    }
  );

  app.get(
    '/api/settings',
    requireRole('owner', 'manager', 'sales', 'accountant', 'inventory'),
    (_req: Request, res: Response) => {
      res.json({ settings: getBusinessSettings() });
    }
  );

  app.put(
    '/api/settings',
    requireRole('owner', 'manager'),
    (req: Request, res: Response) => {
      const current = getBusinessSettings();
      const body = req.body || {};

      const cleanStr = (val: unknown, fallback: string, maxLen = 200) =>
        val !== undefined ? String(val).trim().slice(0, maxLen) : fallback;

      const parsedThreshold =
        body.lowStockThresholdDefault !== undefined
          ? parseStrictInt(body.lowStockThresholdDefault, { min: 0, max: 100000 })
          : null;

      const categories = Array.isArray(body.productCategories)
        ? body.productCategories
            .map((c: unknown) => String(c || '').trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 30)
        : current.productCategories;

      const updated = {
        ...current,
        businessName: cleanStr(body.businessName, current.businessName || 'Shopino', 120),
        businessNameFa: cleanStr(body.businessNameFa, current.businessNameFa || 'شاپینو', 120),
        logoText: cleanStr(body.logoText, current.logoText || 'SH', 6),
        taglineEn: cleanStr(body.taglineEn, current.taglineEn || '', 250),
        taglineFa: cleanStr(body.taglineFa, current.taglineFa || '', 250),
        phone: cleanStr(body.phone, current.phone || '', 40),
        email: cleanStr(body.email, current.email || '', 160),
        addressEn: cleanStr(body.addressEn, current.addressEn || '', 300),
        addressFa: cleanStr(body.addressFa, current.addressFa || '', 300),
        invoicePrefix: cleanStr(body.invoicePrefix, current.invoicePrefix || 'SHP-1404-', 30) || 'SHP-1404-',
        lowStockThresholdDefault:
          parsedThreshold !== null ? parsedThreshold : (current.lowStockThresholdDefault ?? 5),
        usePersianCalendar:
          body.usePersianCalendar !== undefined ? Boolean(body.usePersianCalendar) : current.usePersianCalendar,
        enableInventoryTracking:
          body.enableInventoryTracking !== undefined
            ? Boolean(body.enableInventoryTracking)
            : current.enableInventoryTracking,
        defaultPricingType:
          body.defaultPricingType === 'wholesale'
            ? 'wholesale'
            : body.defaultPricingType === 'retail'
              ? 'retail'
              : current.defaultPricingType || 'retail',
        productCategories: categories,
        currency: 'TOMAN',
      };

      executeSql("INSERT OR REPLACE INTO settings (key, value) VALUES ('business_config', ?)", [
        JSON.stringify(updated),
      ]);
      logAudit(req.user, 'UPDATE', 'settings', 'business_config', `Updated store business configuration`);
      res.json({ settings: updated });
    }
  );

  app.post(
    '/api/settings/reset-demo',
    requireRole('owner'),
    (req: Request, res: Response) => {
      if (!isDemoLoginAllowed()) {
        res.status(403).json({ error: 'بازگردانی داده آزمایشی در محیط عملیاتی (Production) غیرفعال است.' });
        return;
      }
      if (req.body?.confirm !== true) {
        res.status(400).json({ error: 'تأیید صریح عملیات (confirm: true) الزامی است.' });
        return;
      }
      createDatabaseBackup('pre-reset-demo');
      seedDemoData();
      logAudit(req.user, 'RESET_DEMO', 'system', 'demo_data', 'Reloaded sample demo records');
      res.json({ ok: true });
    }
  );

  app.post(
    '/api/settings/purge-demo',
    requireRole('owner'),
    (req: Request, res: Response) => {
      if (req.body?.confirm !== true) {
        res.status(400).json({ error: 'تأیید صریح عملیات (confirm: true) الزامی است.' });
        return;
      }
      purgeDemoData();
      logAudit(req.user, 'PURGE_DEMO', 'system', 'demo_data', 'Purged sample demo records');
      res.json({ ok: true });
    }
  );

  // Unknown API endpoint handler
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'مسیر API مورد نظر یافت نشد.' });
  });

  // Safe global error handler (never expose internal stack traces to client)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Shopino Server Error]:', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'خطای داخلی سرور رخ داده است.' });
    }
  });

  return app;
}

export async function startServer() {
  const app = await createApp();

  // =========================================================================
  // VITE MIDDLEWARE / STATIC ASSETS
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

  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shopino Full-Stack Server listening on http://localhost:${PORT}`);
  });
}

if (process.env.SHOPINO_TEST_MODE !== '1') {
  startServer();
}

