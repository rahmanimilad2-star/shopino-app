import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_DB_DIR = path.resolve(process.cwd(), 'data');

export function getDbFilePath(): string {
  if (process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()) {
    return path.resolve(process.cwd(), process.env.DATABASE_PATH.trim());
  }
  return path.join(DEFAULT_DB_DIR, 'shopino.sqlite');
}

let dbInstance: Database | null = null;
let inTransaction = false;

export function saveDatabase() {
  if (!dbInstance || inTransaction) return;
  const dbFile = getDbFilePath();
  const dbDir = path.dirname(dbFile);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const data = dbInstance.export();
  const tmpFile = `${dbFile}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, Buffer.from(data), { mode: 0o600 });
  fs.renameSync(tmpFile, dbFile);
}

export function createDatabaseBackup(label = 'auto'): string | null {
  const dbFile = getDbFilePath();
  if (!fs.existsSync(dbFile)) return null;
  const backupDir = path.join(path.dirname(dbFile), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '');
  const backupPath = path.join(backupDir, `shopino-${safeLabel}-${stamp}.sqlite.bak`);
  fs.copyFileSync(dbFile, backupPath);

  // Retain at most 10 auto backups to prevent unbounded disk growth
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('shopino-auto-') && f.endsWith('.sqlite.bak'))
      .map((f) => ({ name: f, full: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const old of files.slice(10)) {
      fs.unlinkSync(old.full);
    }
  } catch {
    // ignore backup rotation errors
  }

  return backupPath;
}

export function runTransaction<T>(fn: () => T): T {
  const db = getDb();
  const outer = !inTransaction;
  if (outer) {
    db.run('BEGIN TRANSACTION;');
    inTransaction = true;
  }
  try {
    const result = fn();
    if (outer) {
      db.run('COMMIT;');
      inTransaction = false;
      saveDatabase();
    }
    return result;
  } catch (err) {
    if (outer) {
      try {
        db.run('ROLLBACK;');
      } catch {
        // ignore rollback error
      }
      inTransaction = false;
    }
    throw err;
  }
}

export function legacyHashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_shopino_salt_2026').digest('hex');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(
  password: string,
  storedHash: string
): { valid: boolean; needsRehash: boolean } {
  if (!storedHash || typeof password !== 'string') {
    return { valid: false, needsRehash: false };
  }

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) {
      return { valid: false, needsRehash: false };
    }
    const [, salt, expectedHex] = parts;
    try {
      const actualBuf = crypto.scryptSync(password, salt, 64);
      const expectedBuf = Buffer.from(expectedHex, 'hex');
      if (actualBuf.length !== expectedBuf.length) {
        return { valid: false, needsRehash: false };
      }
      const valid = crypto.timingSafeEqual(actualBuf, expectedBuf);
      return { valid, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Legacy SHA-256 hash migration verification
  const legacyHex = legacyHashPassword(password);
  try {
    const a = Buffer.from(legacyHex, 'utf8');
    const b = Buffer.from(storedHash, 'utf8');
    if (a.length !== b.length) {
      return { valid: false, needsRehash: false };
    }
    const valid = crypto.timingSafeEqual(a, b);
    return { valid, needsRehash: valid };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

export function hashSessionToken(rawToken: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  return 'sha256$' + crypto.createHmac('sha256', secret).update(rawToken).digest('hex');
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * In Shopino, the business currency is integer Toman (تومان).
 * Never multiply or divide by 10 or 100.
 */
export function toCents(amount: number | string): number {
  if (typeof amount !== 'number' && typeof amount !== 'string') return 0;
  const num = typeof amount === 'string' ? Number(amount.trim()) : amount;
  if (!Number.isFinite(num)) return 0;
  return Math.round(num);
}

export function fromCents(tomanInt: number | null | undefined): number {
  if (tomanInt === null || tomanInt === undefined) return 0;
  const num = Number(tomanInt);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num);
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  const rows = queryAll<T>(sql, params);
  return rows[0];
}

export function executeSql(sql: string, params: any[] = []): void {
  const db = getDb();
  db.run(sql, params);
  if (!inTransaction) {
    saveDatabase();
  }
}

export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized yet. Call initDb() first.');
  }
  return dbInstance;
}

export function closeAndResetDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
    inTransaction = false;
  }
}

export async function initDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const dbFile = getDbFilePath();
  if (fs.existsSync(dbFile)) {
    const fileBuffer = fs.readFileSync(dbFile);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  createSchema(dbInstance);
  ensureSeedData();
  migrateExistingDatabase();
  saveDatabase();
  return dbInstance;
}

function createSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_login TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT,
      address TEXT,
      customer_type TEXT NOT NULL DEFAULT 'retail',
      tags TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_notes (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      note TEXT NOT NULL,
      reminder_date TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      name_fa TEXT,
      category TEXT NOT NULL DEFAULT 'عمومی',
      description TEXT,
      notes TEXT,
      unit TEXT NOT NULL DEFAULT 'piece',
      cost_price_cents INTEGER NOT NULL DEFAULT 0,
      sale_price_cents INTEGER NOT NULL DEFAULT 0,
      wholesale_price_cents INTEGER NOT NULL DEFAULT 0,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      min_stock_threshold INTEGER NOT NULL DEFAULT 5,
      product_type TEXT NOT NULL DEFAULT 'physical',
      status TEXT NOT NULL DEFAULT 'active',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      pricing_type TEXT NOT NULL DEFAULT 'retail',
      order_date TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      subtotal_cents INTEGER NOT NULL DEFAULT 0,
      item_discount_cents INTEGER NOT NULL DEFAULT 0,
      order_discount_cents INTEGER NOT NULL DEFAULT 0,
      tax_cents INTEGER NOT NULL DEFAULT 0,
      final_total_cents INTEGER NOT NULL DEFAULT 0,
      cost_total_cents INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      inventory_deducted INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      unit_cost_cents INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      tax_cents INTEGER NOT NULL DEFAULT 0,
      line_total_cents INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      payment_number TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      order_id TEXT,
      payment_date TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      payment_type TEXT NOT NULL DEFAULT 'collection',
      payment_method TEXT NOT NULL DEFAULT 'card',
      reference_number TEXT,
      notes TEXT,
      provider_confirmed INTEGER NOT NULL DEFAULT 1,
      recorded_by TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reference_id TEXT,
      reason TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_fa TEXT NOT NULL,
      message_en TEXT NOT NULL,
      message_fa TEXT NOT NULL,
      target_route TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
  `);
}

function migrateExistingDatabase() {
  // Non-destructive migration:
  // 1. Prune expired sessions
  executeSql('DELETE FROM sessions WHERE expires_at < ?', [new Date().toISOString()]);

  // 2. Upgrade any default untouched SHA-256 staff password hashes to salted scrypt
  const defaultLegacyHash = legacyHashPassword('SellerHub@2026');
  const legacyUsers = queryAll<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE password_hash = ?',
    [defaultLegacyHash]
  );
  if (legacyUsers.length > 0) {
    runTransaction(() => {
      for (const u of legacyUsers) {
        executeSql('UPDATE users SET password_hash = ? WHERE id = ?', [
          hashPassword('SellerHub@2026'),
          u.id,
        ]);
      }
    });
  }
}

export function ensureSeedData() {
  const existingUsers = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users');
  if (!existingUsers || existingUsers.cnt === 0) {
    seedUsersAndSettings();
  }

  const existingDemoCustomers = queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM customers WHERE is_demo = 1'
  );
  const demoSeededFlag = queryOne<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'demo_initialized'"
  );

  if ((!existingDemoCustomers || existingDemoCustomers.cnt === 0) && !demoSeededFlag) {
    seedDemoData();
    executeSql("INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_initialized', '1')");
  }
}

function seedUsersAndSettings() {
  const now = new Date().toISOString();
  const initialOwnerPass =
    process.env.INITIAL_OWNER_PASSWORD && process.env.INITIAL_OWNER_PASSWORD.trim().length >= 8
      ? process.env.INITIAL_OWNER_PASSWORD.trim()
      : 'SellerHub@2026';
  const defaultPass = hashPassword(initialOwnerPass);

  const staff = [
    {
      id: 'usr_owner',
      name: 'Milad Rahmani',
      name_fa: 'میلاد رحمانی (مدیر فروشگاه)',
      email: 'admin@sellerhub.io',
      role: 'owner',
    },
    {
      id: 'usr_manager',
      name: 'Sara Kaviani',
      name_fa: 'سارا کاویانی (سرپرست فروش)',
      email: 'manager@sellerhub.io',
      role: 'manager',
    },
    {
      id: 'usr_sales',
      name: 'Reza Danesh',
      name_fa: 'رضا دانش (صندوق‌دار)',
      email: 'sales@sellerhub.io',
      role: 'sales',
    },
    {
      id: 'usr_accountant',
      name: 'Negin Farhadi',
      name_fa: 'نگین فرهادی (مسئول حسابداری)',
      email: 'finance@sellerhub.io',
      role: 'accountant',
    },
    {
      id: 'usr_inventory',
      name: 'Kaveh Moradi',
      name_fa: 'کاوه مرادی (انباردار)',
      email: 'inventory@sellerhub.io',
      role: 'inventory',
    },
  ];

  for (const u of staff) {
    executeSql(
      `INSERT OR IGNORE INTO users (id, name, name_fa, email, password_hash, role, status, last_login, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [u.id, u.name, u.name_fa, u.email, defaultPass, u.role, now, now]
    );
  }

  const defaultSettings: Record<string, any> = {
    businessName: 'Shopino',
    businessNameFa: 'شاپینو',
    logoText: 'SH',
    taglineEn: 'Simple Retail & Wholesale Sales, Customer Debt & Inventory App',
    taglineFa: 'سامانه ساده و هوشمند مدیریت فروش، مشتریان، بدهی‌ها و انبار ویژه کسب‌وکارها و عمده‌فروشان',
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
    productCategories: ['مواد غذایی و نوشیدنی', 'لوازم دیجیتال و جانبی', 'بهداشتی و شوینده', 'ملزومات بسته‌بندی', 'سایر کالاها'],
  };

  executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES ('business_config', ?)`, [
    JSON.stringify(defaultSettings),
  ]);
}

export function seedDemoData() {
  runTransaction(() => {
    // Clear existing demo records
    executeSql('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1)');
    executeSql('DELETE FROM orders WHERE is_demo = 1');
    executeSql('DELETE FROM payments WHERE is_demo = 1');
    executeSql('DELETE FROM inventory_movements WHERE is_demo = 1');
    executeSql('DELETE FROM customer_notes WHERE is_demo = 1');
    executeSql('DELETE FROM customers WHERE is_demo = 1');
    executeSql('DELETE FROM products WHERE is_demo = 1');
    executeSql('DELETE FROM notifications WHERE is_demo = 1');

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const sixDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);

    // 1. Seed Customers (Retail & Wholesale)
    const demoCustomers = [
      {
        id: 'cust_demo_1',
        code: 'C-101',
        name: 'پخش و عمده‌فروشی برادران محمدی',
        phone: '09121112233',
        email: 'mohammadi@bazar.ir',
        address: 'تهران، بازار بزرگ، سرای امید، پلاک ۱۲',
        customer_type: 'wholesale',
        notes: 'خریدار عمده هفتگی — تسویه توافقی ۱۰ روزه',
        created_at: fifteenDaysAgo,
      },
      {
        id: 'cust_demo_2',
        code: 'C-102',
        name: 'فروشگاه زنجیره‌ای ستاره شهر (شعبه ونک)',
        phone: '09123334455',
        email: 'setareh.shop@gmail.com',
        address: 'تهران، میدان ونک، خیابان ملاصدرا، پلاک ۴۵',
        customer_type: 'wholesale',
        notes: 'مشتری خوش‌حساب عمده — ارسال با پیک فروشگاه',
        created_at: fifteenDaysAgo,
      },
      {
        id: 'cust_demo_3',
        code: 'C-103',
        name: 'علی رضایی (مشتری تک‌فروشی)',
        phone: '09125556677',
        email: '',
        address: 'تهران، سعادت‌آباد، بلوار دریا',
        customer_type: 'retail',
        notes: 'خرید حضوری و تلفنی',
        created_at: tenDaysAgo,
      },
      {
        id: 'cust_demo_4',
        code: 'C-104',
        name: 'سوپرمارکت و پروتئینی بهاران (حسینی)',
        phone: '09127778899',
        email: '',
        address: 'کرج، عظیمیه، میدان مهران',
        customer_type: 'wholesale',
        notes: 'سفارش کارتن و بسته‌ای — دارای مانده بدهی از فاکتور قبلی',
        created_at: tenDaysAgo,
      },
      {
        id: 'cust_demo_5',
        code: 'C-105',
        name: 'مریم نادری',
        phone: '09352223344',
        email: '',
        address: 'تهران، خیابان شریعتی، بالاتر از میرداماد',
        customer_type: 'retail',
        notes: 'مشتری ثابت خرده‌فروشی',
        created_at: sixDaysAgo,
      },
    ];

    for (const c of demoCustomers) {
      executeSql(
        `INSERT INTO customers (id, code, name, phone, email, address, customer_type, tags, notes, status, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, 'active', 1, ?, ?)`,
        [c.id, c.code, c.name, c.phone, c.email, c.address, c.customer_type, c.notes, c.created_at, c.created_at]
      );
    }

    // 2. Seed Products in Integer Toman (with Retail Price, Wholesale Price, Purchase Cost, Unit)
    const demoProducts = [
      {
        id: 'prd_demo_1',
        sku: 'P-1001',
        name: 'قهوه اسپرسو ویژه عربیکا ۱ کیلویی (بسته اورجینال)',
        name_fa: 'قهوه اسپرسو ویژه عربیکا ۱ کیلویی (بسته اورجینال)',
        category: 'مواد غذایی و نوشیدنی',
        unit: 'pack',
        cost: 780000, // ۷۸۰,۰۰۰ تومان
        retail: 1150000, // ۱,۱۵۰,۰۰۰ تومان
        wholesale: 980000, // ۹۸۰,۰۰۰ تومان
        stock: 42,
        min: 10,
        notes: 'پرفروش‌ترین محصول فروشگاه',
      },
      {
        id: 'prd_demo_2',
        sku: 'P-1002',
        name: 'روغن زیتون فرابکر ممتاز (کارتن ۶ عددی)',
        name_fa: 'روغن زیتون فرابکر ممتاز (کارتن ۶ عددی)',
        category: 'مواد غذایی و نوشیدنی',
        unit: 'box',
        cost: 2100000, // ۲,۱۰۰,۰۰۰ تومان
        retail: 2850000, // ۲,۸۵۰,۰۰۰ تومان
        wholesale: 2550000, // ۲,۵۵۰,۰۰۰ تومان
        stock: 18,
        min: 6,
        notes: 'مناسب فروش عمده و سوپرمارکت‌ها',
      },
      {
        id: 'prd_demo_3',
        sku: 'P-1003',
        name: 'پاوربانک فست‌شارژ ۲۰۰۰۰ میلی‌آمپر شیائومی',
        name_fa: 'پاوربانک فست‌شارژ ۲۰۰۰۰ میلی‌آمپر شیائومی',
        category: 'لوازم دیجیتال و جانبی',
        unit: 'piece',
        cost: 1200000, // ۱,۲۰۰,۰۰۰ تومان
        retail: 1680000, // ۱,۶۸۰,۰۰۰ تومان
        wholesale: 1490000, // ۱,۴۹۰,۰۰۰ تومان
        stock: 3, // Low stock! (min: 8)
        min: 8,
        notes: 'گارانتی ۱۸ ماهه شرکتی',
      },
      {
        id: 'prd_demo_4',
        sku: 'P-1004',
        name: 'هدفون بلوتوثی بی‌سیم مدل Pro ANC',
        name_fa: 'هدفون بلوتوثی بی‌سیم مدل Pro ANC',
        category: 'لوازم دیجیتال و جانبی',
        unit: 'piece',
        cost: 950000, // ۹۵۰,۰۰۰ تومان
        retail: 1450000, // ۱,۴۵۰,۰۰۰ تومان
        wholesale: 1250000, // ۱,۲۵۰,۰۰۰ تومان
        stock: 25,
        min: 5,
        notes: 'رنگ مشکی و سفید',
      },
      {
        id: 'prd_demo_5',
        sku: 'P-1005',
        name: 'پک شوینده و مایع دستشویی ۴ لیتری (بسته ۴ عددی)',
        name_fa: 'پک شوینده و مایع دستشویی ۴ لیتری (بسته ۴ عددی)',
        category: 'بهداشتی و شوینده',
        unit: 'box',
        cost: 490000, // ۴۹۰,۰۰۰ تومان
        retail: 720000, // ۷۲۰,۰۰۰ تومان
        wholesale: 630000, // ۶۳۰,۰۰۰ تومان
        stock: 4, // Low stock! (min: 10)
        min: 10,
        notes: 'موجودی انبار رو به اتمام است',
      },
      {
        id: 'prd_demo_6',
        sku: 'P-1006',
        name: 'چای سیاه باروتی سیلان ۵۰۰ گرمی',
        name_fa: 'چای سیاه باروتی سیلان ۵۰۰ گرمی',
        category: 'مواد غذایی و نوشیدنی',
        unit: 'pack',
        cost: 310000, // ۳۱۰,۰۰۰ تومان
        retail: 450000, // ۴۵۰,۰۰۰ تومان
        wholesale: 395000, // ۳۹۵,۰۰۰ تومان
        stock: 60,
        min: 15,
        notes: 'بسته‌بندی فلزی وکیوم',
      },
      {
        id: 'prd_demo_7',
        sku: 'P-1007',
        name: 'رول نایلون و سلفون بسته‌بندی صنعتی (۵۰ متری)',
        name_fa: 'رول نایلون و سلفون بسته‌بندی صنعتی (۵۰ متری)',
        category: 'ملزومات بسته‌بندی',
        unit: 'meter',
        cost: 220000, // ۲۲۰,۰۰۰ تومان
        retail: 340000, // ۳۴۰,۰۰۰ تومان
        wholesale: 290000, // ۲۹۰,۰۰۰ تومان
        stock: 2, // Low stock! (min: 6)
        min: 6,
        notes: 'عرض ۵۰ سانتی‌متر ضخیم',
      },
    ];

    for (const p of demoProducts) {
      executeSql(
        `INSERT INTO products (id, sku, name, name_fa, category, description, notes, unit, cost_price_cents, sale_price_cents, wholesale_price_cents, stock_quantity, min_stock_threshold, product_type, status, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'physical', 'active', 1, ?, ?)`,
        [
          p.id,
          p.sku,
          p.name,
          p.name_fa,
          p.category,
          p.notes,
          p.notes,
          p.unit,
          p.cost,
          p.retail,
          p.wholesale,
          p.stock,
          p.min,
          fifteenDaysAgo,
          todayStr,
        ]
      );
    }

    // 3. Seed Sales / Orders (including TODAY's orders and past orders, retail & wholesale, paid, partial, credit)
    const demoOrders = [
      {
        id: 'ord_demo_1',
        num: 'SHP-1404-1001',
        cust: 'cust_demo_1', // Wholesale: برادران محمدی
        pricing_type: 'wholesale',
        date: tenDaysAgo,
        due: yesterday, // Overdue debt!
        status: 'completed',
        order_discount: 300000, // ۳۰۰,۰۰۰ تومان تخفیف
        notes: 'فاکتور عمده هفتگی — ۵ میلیون تومان پیش‌پرداخت، الباقی نسیه',
        items: [
          { prd: demoProducts[0], qty: 10, price: 980000 }, // 9,800,000
          { prd: demoProducts[1], qty: 4, price: 2550000 }, // 10,200,000
        ], // Subtotal: 20,000,000 | Discount: 300,000 | Final Total: 19,700,000
      },
      {
        id: 'ord_demo_2',
        num: 'SHP-1404-1002',
        cust: 'cust_demo_2', // Wholesale: فروشگاه ستاره شهر
        pricing_type: 'wholesale',
        date: sixDaysAgo,
        due: sixDaysAgo,
        status: 'completed',
        order_discount: 0,
        notes: 'تسویه کامل کارت به کارت در زمان تحویل',
        items: [
          { prd: demoProducts[3], qty: 6, price: 1250000 }, // 7,500,000
          { prd: demoProducts[5], qty: 10, price: 395000 }, // 3,950,000
        ], // Final Total: 11,450,000 (Fully Paid)
      },
      {
        id: 'ord_demo_3',
        num: 'SHP-1404-1003',
        cust: 'cust_demo_4', // Wholesale: سوپرمارکت بهاران
        pricing_type: 'wholesale',
        date: threeDaysAgo,
        due: yesterday, // Overdue debt!
        status: 'completed',
        order_discount: 100000,
        notes: 'فروش نسیه به سوپرمارکت بهاران',
        items: [
          { prd: demoProducts[4], qty: 8, price: 630000 }, // 5,040,000
          { prd: demoProducts[5], qty: 6, price: 395000 }, // 2,370,000
        ], // Subtotal: 7,410,000 | Discount: 100,000 | Final Total: 7,310,000 (Unpaid on credit)
      },
      {
        id: 'ord_demo_4',
        num: 'SHP-1404-1004',
        cust: 'cust_demo_3', // Retail: علی رضایی
        pricing_type: 'retail',
        date: todayStr, // TODAY!
        due: todayStr,
        status: 'completed',
        order_discount: 50000,
        notes: 'فروش حضوری امروز — پرداخت با کارت‌خوان',
        items: [
          { prd: demoProducts[0], qty: 2, price: 1150000 }, // 2,300,000
          { prd: demoProducts[5], qty: 2, price: 450000 }, // 900,000
        ], // Subtotal: 3,200,000 | Discount: 50,000 | Final Total: 3,150,000 (Paid Today)
      },
      {
        id: 'ord_demo_5',
        num: 'SHP-1404-1005',
        cust: null, // Walk-in / Anonymous customer TODAY!
        pricing_type: 'retail',
        date: todayStr, // TODAY!
        due: todayStr,
        status: 'completed',
        order_discount: 0,
        notes: 'فروش سریع به مشتری حضوری (نقدی)',
        items: [
          { prd: demoProducts[2], qty: 1, price: 1680000 }, // 1,680,000
          { prd: demoProducts[3], qty: 1, price: 1450000 }, // 1,450,000
        ], // Final Total: 3,130,000 (Paid Today)
      },
      {
        id: 'ord_demo_6',
        num: 'SHP-1404-1006',
        cust: 'cust_demo_5', // Retail: مریم نادری TODAY!
        pricing_type: 'retail',
        date: todayStr, // TODAY!
        due: todayStr,
        status: 'preparing',
        order_discount: 0,
        notes: 'سفارش تلفنی امروز — بخشی پرداخت شده و الباقی هنگام تحویل',
        items: [
          { prd: demoProducts[1], qty: 1, price: 2850000 }, // 2,850,000
        ], // Final Total: 2,850,000 (1,500,000 Paid Today, 1,350,000 Remaining)
      },
    ];

    for (const o of demoOrders) {
      let subtotal = 0;
      let costTotal = 0;

      for (const item of o.items) {
        const lineTotal = item.price * item.qty;
        const lineCost = item.prd.cost * item.qty;
        subtotal += lineTotal;
        costTotal += lineCost;

        executeSql(
          `INSERT INTO order_items (id, order_id, product_id, product_name, sku, quantity, unit_price_cents, unit_cost_cents, discount_cents, tax_rate, tax_cents, line_total_cents)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
          [
            generateId('item'),
            o.id,
            item.prd.id,
            item.prd.name,
            item.prd.sku,
            item.qty,
            item.price,
            item.prd.cost,
            lineTotal,
          ]
        );
      }

      const finalTotal = Math.max(0, subtotal - o.order_discount);

      executeSql(
        `INSERT INTO orders (id, order_number, customer_id, pricing_type, order_date, due_date, status, subtotal_cents, item_discount_cents, order_discount_cents, tax_cents, final_total_cents, cost_total_cents, notes, inventory_deducted, created_by, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, 1, 'میلاد رحمانی', 1, ?, ?)`,
        [
          o.id,
          o.num,
          o.cust,
          o.pricing_type,
          o.date,
          o.due,
          o.status,
          subtotal,
          o.order_discount,
          finalTotal,
          costTotal,
          o.notes,
          o.date,
          o.date,
        ]
      );
    }

    // 4. Seed Payments in Integer Toman
    const demoPayments = [
      {
        id: 'pay_demo_1',
        num: 'REC-1404-501',
        cust: 'cust_demo_1',
        ord: 'ord_demo_1',
        date: tenDaysAgo,
        amount: 12000000, // ۱۲,۰۰۰,۰۰۰ تومان پرداخت از ۱۹,۷۰۰,۰۰۰ تومان (مانده بدهی: ۷,۷۰۰,۰۰۰ تومان)
        method: 'bank_transfer',
        ref: 'IR-8849201',
        notes: 'پیش‌پرداخت فاکتور SHP-1404-1001',
      },
      {
        id: 'pay_demo_2',
        num: 'REC-1404-502',
        cust: 'cust_demo_2',
        ord: 'ord_demo_2',
        date: sixDaysAgo,
        amount: 11450000, // تسویه کامل ۱۱,۴۵۰,۰۰۰ تومان
        method: 'bank_transfer',
        ref: 'IR-9920144',
        notes: 'تسویه کامل فاکتور SHP-1404-1002',
      },
      {
        id: 'pay_demo_3',
        num: 'REC-1404-503',
        cust: 'cust_demo_3',
        ord: 'ord_demo_4',
        date: todayStr, // TODAY!
        amount: 3150000, // تسویه کامل ۳,۱۵۰,۰۰۰ تومان امروز
        method: 'card',
        ref: 'POS-77412',
        notes: 'دریافت با دستگاه کارت‌خوان بابت فاکتور SHP-1404-1004',
      },
      {
        id: 'pay_demo_4',
        num: 'REC-1404-504',
        cust: null, // Walk-in customer payment TODAY!
        ord: 'ord_demo_5',
        date: todayStr, // TODAY!
        amount: 3130000, // تسویه کامل ۳,۱۳۰,۰۰۰ تومان مشتری حضوری امروز
        method: 'cash',
        ref: 'CASH-105',
        notes: 'دریافت نقدی فروش حضوری SHP-1404-1005',
      },
      {
        id: 'pay_demo_5',
        num: 'REC-1404-505',
        cust: 'cust_demo_5',
        ord: 'ord_demo_6',
        date: todayStr, // TODAY!
        amount: 1500000, // ۱,۵۰۰,۰۰۰ تومان بیعانه امروز (مانده بدهی: ۱,۳۵۰,۰۰۰ تومان)
        method: 'card',
        ref: 'POS-77489',
        notes: 'بیعانه سفارش تلفنی SHP-1404-1006',
      },
    ];

    for (const p of demoPayments) {
      executeSql(
        `INSERT INTO payments (id, payment_number, customer_id, order_id, payment_date, amount_cents, payment_type, payment_method, reference_number, notes, provider_confirmed, recorded_by, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'collection', ?, ?, ?, 1, 'میلاد رحمانی', 1, ?)`,
        [p.id, p.num, p.cust, p.ord, p.date, p.amount, p.method, p.ref, p.notes, p.date]
      );
    }

    // 5. Seed Inventory Movements
    executeSql(
      `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at)
       VALUES (?, 'prd_demo_1', 'purchase', 50, 4, 54, 'INIT-101', 'موجودی اولیه انبار', 'کاوه مرادی', 1, ?)`,
      [generateId('mov'), fifteenDaysAgo]
    );
    executeSql(
      `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at)
       VALUES (?, 'prd_demo_1', 'sale', -12, 54, 42, 'SHP-1404-1001', 'کسر بابت فروش فاکتورها', 'میلاد رحمانی', 1, ?)`,
      [generateId('mov'), todayStr]
    );

    // 6. Seed Notifications
    const notifs = [
      {
        id: 'ntf_demo_1',
        type: 'low_stock',
        title_en: 'Low Stock Warning: Xiaomi 20000mAh PowerBank',
        title_fa: 'هشدار کمبود موجودی: پاوربانک شیائومی ۲۰۰۰۰',
        message_en: 'Only 3 units remaining in stock (Minimum threshold: 8 units).',
        message_fa: 'تنها ۳ عدد در انبار باقی مانده است (حد مجاز هشدار: ۸ عدد).',
        route: '/products',
      },
      {
        id: 'ntf_demo_2',
        type: 'overdue_invoice',
        title_en: 'Customer Debt Reminder: Mohammadi Bros Wholesale',
        title_fa: 'یادآوری بدهی مشتری: پخش برادران محمدی',
        message_en: 'Remaining balance of 7,700,000 TOMAN on Order SHP-1404-1001 is past due.',
        message_fa: 'مبلغ ۷,۷۰۰,۰۰۰ تومان از فاکتور SHP-1404-1001 سررسید شده است.',
        route: '/payments',
      },
      {
        id: 'ntf_demo_3',
        type: 'overdue_invoice',
        title_en: 'Customer Debt Reminder: Baharan Supermarket',
        title_fa: 'یادآوری بدهی مشتری: سوپرمارکت بهاران',
        message_en: 'Credit sale SHP-1404-1003 with 7,310,000 TOMAN balance is awaiting collection.',
        message_fa: 'فاکتور نسیه SHP-1404-1003 به مبلغ ۷,۳۱۰,۰۰۰ تومان در انتظار تسویه است.',
        route: '/payments',
      },
    ];

    for (const n of notifs) {
      executeSql(
        `INSERT INTO notifications (id, type, title_en, title_fa, message_en, message_fa, target_route, is_read, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
        [n.id, n.type, n.title_en, n.title_fa, n.message_en, n.message_fa, n.route, todayStr]
      );
    }
  });
}

export function purgeDemoData() {
  createDatabaseBackup('auto-pre-purge');
  runTransaction(() => {
    executeSql('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1)');
    executeSql('DELETE FROM orders WHERE is_demo = 1');
    executeSql('DELETE FROM payments WHERE is_demo = 1');
    executeSql('DELETE FROM inventory_movements WHERE is_demo = 1');
    executeSql('DELETE FROM customer_notes WHERE is_demo = 1');
    executeSql('DELETE FROM customers WHERE is_demo = 1');
    executeSql('DELETE FROM products WHERE is_demo = 1');
    executeSql('DELETE FROM notifications WHERE is_demo = 1');
  });
}

export const BACKUP_FORMAT_ID = 'shopino-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export const REQUIRED_BACKUP_TABLES = [
  'settings',
  'users',
  'customers',
  'customer_notes',
  'products',
  'orders',
  'order_items',
  'payments',
  'inventory_movements',
  'notifications',
  'audit_logs',
] as const;

export type BackupTableName = (typeof REQUIRED_BACKUP_TABLES)[number];

export interface BackupTablesPayload {
  settings: any[];
  users: any[];
  customers: any[];
  customer_notes: any[];
  products: any[];
  orders: any[];
  order_items: any[];
  payments: any[];
  inventory_movements: any[];
  notifications: any[];
  audit_logs: any[];
}

export interface ShopinoBackupPackage {
  format: string;
  schemaVersion: number;
  createdAt: string;
  exportedBy: {
    id: string;
    name: string;
    email: string;
  };
  recordCounts: Record<BackupTableName, number>;
  sha256Checksum: string;
  tables: BackupTablesPayload;
}

function canonicalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      result[k] = canonicalizeValue(obj[k]);
    }
    return result;
  }
  return val;
}

export function computeBackupChecksum(tables: BackupTablesPayload): string {
  const canonicalPayload = canonicalizeValue({
    format: BACKUP_FORMAT_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    tables,
  });
  const serialized = JSON.stringify(canonicalPayload);
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}

export function createVerifiedDatabaseBackup(label = 'pre-restore'): string {
  saveDatabase();
  const dbFile = getDbFilePath();
  if (!fs.existsSync(dbFile)) {
    throw new Error('فایل پایگاه داده فعلی برای ایجاد نسخه پشتیبان ایمنی یافت نشد.');
  }
  const backupPath = createDatabaseBackup(label);
  if (!backupPath || !fs.existsSync(backupPath)) {
    throw new Error('ایجاد فایل پشتیبان ایمنی پیش از بازیابی ناموفق بود.');
  }

  const srcBuf = fs.readFileSync(dbFile);
  const bakBuf = fs.readFileSync(backupPath);
  if (bakBuf.length === 0 || bakBuf.length !== srcBuf.length) {
    throw new Error('اندازه فایل پشتیبان ایمنی با پایگاه داده فعلی مطابقت ندارد.');
  }

  const sqliteMagic = 'SQLite format 3\0';
  if (bakBuf.subarray(0, 16).toString('utf8') !== sqliteMagic) {
    throw new Error('هدر فایل پشتیبان ایمنی SQLite معتبر نیست.');
  }

  const srcHash = crypto.createHash('sha256').update(srcBuf).digest();
  const bakHash = crypto.createHash('sha256').update(bakBuf).digest();
  if (!crypto.timingSafeEqual(srcHash, bakHash)) {
    throw new Error('تأیید یکپارچگی (SHA-256) نسخه پشتیبان ایمنی پیش از بازیابی ناموفق بود.');
  }

  return backupPath;
}

export function exportDatabaseSnapshot(exportedBy: {
  id: string;
  name: string;
  email: string;
}): ShopinoBackupPackage {
  const tables: BackupTablesPayload = {
    settings: queryAll('SELECT key, value FROM settings ORDER BY key ASC'),
    // Sanitize user records: never export password_hash or session tokens
    users: queryAll(
      'SELECT id, name, name_fa, email, role, status, last_login, created_at FROM users ORDER BY id ASC'
    ),
    customers: queryAll(
      'SELECT id, code, name, phone, email, address, customer_type, tags, notes, status, is_demo, created_at, updated_at FROM customers ORDER BY id ASC'
    ),
    customer_notes: queryAll(
      'SELECT id, customer_id, author_name, note, reminder_date, is_completed, is_demo, created_at FROM customer_notes ORDER BY id ASC'
    ),
    products: queryAll(
      'SELECT id, sku, name, name_fa, category, description, notes, unit, cost_price_cents, sale_price_cents, wholesale_price_cents, stock_quantity, min_stock_threshold, product_type, status, is_demo, created_at, updated_at FROM products ORDER BY id ASC'
    ),
    orders: queryAll(
      'SELECT id, order_number, customer_id, pricing_type, order_date, due_date, status, subtotal_cents, item_discount_cents, order_discount_cents, tax_cents, final_total_cents, cost_total_cents, notes, inventory_deducted, created_by, is_demo, created_at, updated_at FROM orders ORDER BY id ASC'
    ),
    order_items: queryAll(
      'SELECT id, order_id, product_id, product_name, sku, quantity, unit_price_cents, unit_cost_cents, discount_cents, tax_rate, tax_cents, line_total_cents FROM order_items ORDER BY id ASC'
    ),
    payments: queryAll(
      'SELECT id, payment_number, customer_id, order_id, payment_date, amount_cents, payment_type, payment_method, reference_number, notes, provider_confirmed, recorded_by, is_demo, created_at FROM payments ORDER BY id ASC'
    ),
    inventory_movements: queryAll(
      'SELECT id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at FROM inventory_movements ORDER BY id ASC'
    ),
    notifications: queryAll(
      'SELECT id, type, title_en, title_fa, message_en, message_fa, target_route, is_read, is_demo, created_at FROM notifications ORDER BY id ASC'
    ),
    audit_logs: queryAll(
      'SELECT id, user_id, user_name, user_role, action, entity_type, entity_id, summary, created_at FROM audit_logs ORDER BY id ASC'
    ),
  };

  const recordCounts: Record<BackupTableName, number> = {
    settings: tables.settings.length,
    users: tables.users.length,
    customers: tables.customers.length,
    customer_notes: tables.customer_notes.length,
    products: tables.products.length,
    orders: tables.orders.length,
    order_items: tables.order_items.length,
    payments: tables.payments.length,
    inventory_movements: tables.inventory_movements.length,
    notifications: tables.notifications.length,
    audit_logs: tables.audit_logs.length,
  };

  const sha256Checksum = computeBackupChecksum(tables);

  return {
    format: BACKUP_FORMAT_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    exportedBy: {
      id: exportedBy.id,
      name: exportedBy.name,
      email: exportedBy.email,
    },
    recordCounts,
    sha256Checksum,
    tables,
  };
}

function isNonEmptyString(val: unknown, maxLen = 2000): val is string {
  return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLen;
}

function isNonNegativeSafeInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 0;
}

function isSafeInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val);
}

export function validateBackupPackage(raw: unknown): ShopinoBackupPackage {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('ساختار فایل پشتیبان نامعتبر است.');
  }

  const pkg = raw as Record<string, any>;
  if (pkg.format !== BACKUP_FORMAT_ID) {
    throw new Error('فرمت فایل پشتیبان متعلق به سامانه شاپینو نیست.');
  }
  if (pkg.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`نسخه ساختار فایل پشتیبان (${String(pkg.schemaVersion)}) پشتیبانی نمی‌شود.`);
  }

  if (!pkg.tables || typeof pkg.tables !== 'object' || Array.isArray(pkg.tables)) {
    throw new Error('بخش جداول اطلاعات (tables) در فایل پشتیبان یافت نشد.');
  }

  // Reject unexpected table keys
  const providedKeys = Object.keys(pkg.tables);
  for (const k of providedKeys) {
    if (!REQUIRED_BACKUP_TABLES.includes(k as BackupTableName)) {
      throw new Error(`جدول ناشناخته «${k}» در فایل پشتیبان وجود دارد.`);
    }
  }

  for (const reqTable of REQUIRED_BACKUP_TABLES) {
    if (!Array.isArray(pkg.tables[reqTable])) {
      throw new Error(`جدول الزامی «${reqTable}» در فایل پشتیبان وجود ندارد یا آرایه نیست.`);
    }
  }

  if (pkg.recordCounts !== undefined) {
    if (!pkg.recordCounts || typeof pkg.recordCounts !== 'object' || Array.isArray(pkg.recordCounts)) {
      throw new Error('ساختار شمارش رکوردها (recordCounts) در فایل پشتیبان نامعتبر است.');
    }
    for (const reqTable of REQUIRED_BACKUP_TABLES) {
      if (
        pkg.recordCounts[reqTable] !== undefined &&
        pkg.recordCounts[reqTable] !== pkg.tables[reqTable].length
      ) {
        throw new Error(`تعداد رکوردهای جدول «${reqTable}» با متادیتای فایل پشتیبان مطابقت ندارد.`);
      }
    }
  }

  if (typeof pkg.sha256Checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(pkg.sha256Checksum)) {
    throw new Error('کد کنترلی یکپارچگی (sha256Checksum) در فایل پشتیبان وجود ندارد یا نامعتبر است.');
  }

  const tables = pkg.tables as BackupTablesPayload;
  const expectedChecksum = computeBackupChecksum(tables);
  const actualBuf = Buffer.from(pkg.sha256Checksum.toLowerCase(), 'utf8');
  const expectedBuf = Buffer.from(expectedChecksum.toLowerCase(), 'utf8');
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    throw new Error('عدم تطابق امضای دیجیتال (SHA-256 Checksum): فایل پشتیبان دستکاری یا خراب شده است.');
  }

  // Validate rows & referential integrity before touching the database
  const validRoles = new Set(['owner', 'manager', 'sales', 'accountant', 'inventory']);
  const validUserStatuses = new Set(['active', 'suspended']);
  const validRecordStatuses = new Set(['active', 'archived']);
  const validCustomerTypes = new Set(['retail', 'wholesale']);
  const validOrderStatuses = new Set(['registered', 'preparing', 'completed', 'cancelled']);
  const validPaymentTypes = new Set(['collection', 'advance', 'refund']);
  const validPaymentMethods = new Set(['cash', 'card', 'transfer', 'bank_transfer', 'online', 'cheque']);

  for (const s of tables.settings) {
    if (!s || typeof s !== 'object' || !isNonEmptyString(s.key, 120) || typeof s.value !== 'string') {
      throw new Error('رکورد نامعتبر در جدول تنظیمات (settings) یافت شد.');
    }
  }

  if (tables.users.length === 0) {
    throw new Error('فایل پشتیبان باید حداقل شامل یک حساب کاربری باشد.');
  }
  const userIds = new Set<string>();
  const userEmails = new Set<string>();
  for (const u of tables.users) {
    if (
      !u ||
      typeof u !== 'object' ||
      !isNonEmptyString(u.id, 100) ||
      !isNonEmptyString(u.name, 160) ||
      !isNonEmptyString(u.name_fa, 160) ||
      !isNonEmptyString(u.email, 180) ||
      !validRoles.has(u.role) ||
      !validUserStatuses.has(u.status || 'active') ||
      !isNonEmptyString(u.created_at, 60)
    ) {
      throw new Error('رکورد نامعتبر در جدول کاربران (users) یافت شد.');
    }
    if (u.password_hash !== undefined) {
      throw new Error('فایل پشتیبان نباید حاوی هش رمز عبور خام (password_hash) باشد.');
    }
    const normEmail = u.email.trim().toLowerCase();
    if (userIds.has(u.id) || userEmails.has(normEmail)) {
      throw new Error('شناسه یا ایمیل تکراری در جدول کاربران فایل پشتیبان وجود دارد.');
    }
    userIds.add(u.id);
    userEmails.add(normEmail);
  }

  const customerIds = new Set<string>();
  const customerCodes = new Set<string>();
  for (const c of tables.customers) {
    if (
      !c ||
      typeof c !== 'object' ||
      !isNonEmptyString(c.id, 100) ||
      !isNonEmptyString(c.code, 60) ||
      !isNonEmptyString(c.name, 180) ||
      !validCustomerTypes.has(c.customer_type || 'retail') ||
      !validRecordStatuses.has(c.status || 'active') ||
      !isNonEmptyString(c.created_at, 60) ||
      !isNonEmptyString(c.updated_at, 60)
    ) {
      throw new Error('رکورد نامعتبر در جدول مشتریان (customers) یافت شد.');
    }
    if (customerIds.has(c.id) || customerCodes.has(c.code)) {
      throw new Error('شناسه یا کد تکراری در جدول مشتریان فایل پشتیبان وجود دارد.');
    }
    customerIds.add(c.id);
    customerCodes.add(c.code);
  }

  for (const cn of tables.customer_notes) {
    if (
      !cn ||
      typeof cn !== 'object' ||
      !isNonEmptyString(cn.id, 100) ||
      !isNonEmptyString(cn.customer_id, 100) ||
      !customerIds.has(cn.customer_id) ||
      !isNonEmptyString(cn.author_name, 160) ||
      !isNonEmptyString(cn.note, 2000) ||
      !isNonEmptyString(cn.created_at, 60)
    ) {
      throw new Error('رکورد نامعتبر یا فاقد مشتری مرتبط در جدول یادداشت‌های مشتری (customer_notes) یافت شد.');
    }
  }

  const productIds = new Set<string>();
  const productSkus = new Set<string>();
  for (const p of tables.products) {
    if (
      !p ||
      typeof p !== 'object' ||
      !isNonEmptyString(p.id, 100) ||
      !isNonEmptyString(p.sku, 80) ||
      !isNonEmptyString(p.name, 180) ||
      !isNonNegativeSafeInt(p.cost_price_cents) ||
      !isNonNegativeSafeInt(p.sale_price_cents) ||
      !isNonNegativeSafeInt(p.wholesale_price_cents) ||
      !isNonNegativeSafeInt(p.stock_quantity) ||
      !isNonNegativeSafeInt(p.min_stock_threshold) ||
      !validRecordStatuses.has(p.status || 'active') ||
      !isNonEmptyString(p.created_at, 60) ||
      !isNonEmptyString(p.updated_at, 60)
    ) {
      throw new Error('رکورد نامعتبر در جدول کالاها (products) یافت شد.');
    }
    const upperSku = p.sku.trim().toUpperCase();
    if (productIds.has(p.id) || productSkus.has(upperSku)) {
      throw new Error('شناسه یا کد کالای (SKU) تکراری در جدول کالاها وجود دارد.');
    }
    productIds.add(p.id);
    productSkus.add(upperSku);
  }

  const orderIds = new Set<string>();
  const orderNumbers = new Set<string>();
  for (const o of tables.orders) {
    if (
      !o ||
      typeof o !== 'object' ||
      !isNonEmptyString(o.id, 100) ||
      !isNonEmptyString(o.order_number, 80) ||
      (o.customer_id !== null && o.customer_id !== undefined && !customerIds.has(String(o.customer_id))) ||
      !validCustomerTypes.has(o.pricing_type || 'retail') ||
      !isNonEmptyString(o.order_date, 40) ||
      !validOrderStatuses.has(o.status) ||
      !isNonNegativeSafeInt(o.subtotal_cents) ||
      !isNonNegativeSafeInt(o.item_discount_cents) ||
      !isNonNegativeSafeInt(o.order_discount_cents) ||
      !isNonNegativeSafeInt(o.tax_cents) ||
      !isNonNegativeSafeInt(o.final_total_cents) ||
      !isNonNegativeSafeInt(o.cost_total_cents) ||
      !isNonEmptyString(o.created_by, 160) ||
      !isNonEmptyString(o.created_at, 60) ||
      !isNonEmptyString(o.updated_at, 60)
    ) {
      throw new Error('رکورد نامعتبر در جدول سفارش‌ها (orders) یافت شد.');
    }
    if (orderIds.has(o.id) || orderNumbers.has(o.order_number)) {
      throw new Error('شناسه یا شماره فاکتور تکراری در جدول سفارش‌ها وجود دارد.');
    }
    orderIds.add(o.id);
    orderNumbers.add(o.order_number);
  }

  const orderItemIds = new Set<string>();
  for (const oi of tables.order_items) {
    if (
      !oi ||
      typeof oi !== 'object' ||
      !isNonEmptyString(oi.id, 100) ||
      !isNonEmptyString(oi.order_id, 100) ||
      !orderIds.has(oi.order_id) ||
      !isNonEmptyString(oi.product_id, 100) ||
      !productIds.has(oi.product_id) ||
      !isNonEmptyString(oi.product_name, 180) ||
      !isNonEmptyString(oi.sku, 80) ||
      !isSafeInt(oi.quantity) ||
      oi.quantity < 1 ||
      !isNonNegativeSafeInt(oi.unit_price_cents) ||
      !isNonNegativeSafeInt(oi.unit_cost_cents) ||
      !isNonNegativeSafeInt(oi.discount_cents) ||
      !isNonNegativeSafeInt(oi.line_total_cents)
    ) {
      throw new Error('رکورد نامعتبر در اقلام سفارش (order_items) یافت شد.');
    }
    if (orderItemIds.has(oi.id)) {
      throw new Error('شناسه تکراری در اقلام سفارش (order_items) وجود دارد.');
    }
    orderItemIds.add(oi.id);
  }

  const paymentIds = new Set<string>();
  const paymentNumbers = new Set<string>();
  for (const pay of tables.payments) {
    if (
      !pay ||
      typeof pay !== 'object' ||
      !isNonEmptyString(pay.id, 100) ||
      !isNonEmptyString(pay.payment_number, 80) ||
      (pay.customer_id !== null && pay.customer_id !== undefined && !customerIds.has(String(pay.customer_id))) ||
      (pay.order_id !== null && pay.order_id !== undefined && !orderIds.has(String(pay.order_id))) ||
      !isNonEmptyString(pay.payment_date, 40) ||
      !isSafeInt(pay.amount_cents) ||
      pay.amount_cents <= 0 ||
      !validPaymentTypes.has(pay.payment_type || 'collection') ||
      !validPaymentMethods.has(pay.payment_method || 'card') ||
      !isNonEmptyString(pay.recorded_by, 160) ||
      !isNonEmptyString(pay.created_at, 60)
    ) {
      throw new Error('رکورد نامعتبر در جدول پرداخت‌ها (payments) یافت شد.');
    }
    if (paymentIds.has(pay.id) || paymentNumbers.has(pay.payment_number)) {
      throw new Error('شناسه یا شماره رسید تکراری در جدول پرداخت‌ها وجود دارد.');
    }
    paymentIds.add(pay.id);
    paymentNumbers.add(pay.payment_number);
  }

  const movementIds = new Set<string>();
  for (const m of tables.inventory_movements) {
    if (
      !m ||
      typeof m !== 'object' ||
      !isNonEmptyString(m.id, 100) ||
      !isNonEmptyString(m.product_id, 100) ||
      !productIds.has(m.product_id) ||
      !isNonEmptyString(m.movement_type, 50) ||
      !isSafeInt(m.quantity_change) ||
      m.quantity_change === 0 ||
      !isNonNegativeSafeInt(m.previous_stock) ||
      !isNonNegativeSafeInt(m.new_stock) ||
      !isNonEmptyString(m.reason, 500) ||
      !isNonEmptyString(m.actor_name, 160) ||
      !isNonEmptyString(m.created_at, 60)
    ) {
      throw new Error('رکورد نامعتبر در تاریخچه انبار (inventory_movements) یافت شد.');
    }
    if (movementIds.has(m.id)) {
      throw new Error('شناسه تکراری در تاریخچه انبار (inventory_movements) وجود دارد.');
    }
    movementIds.add(m.id);
  }

  const notifIds = new Set<string>();
  for (const n of tables.notifications) {
    if (
      !n ||
      typeof n !== 'object' ||
      !isNonEmptyString(n.id, 100) ||
      !isNonEmptyString(n.type, 60) ||
      !isNonEmptyString(n.title_en, 300) ||
      !isNonEmptyString(n.title_fa, 300) ||
      !isNonEmptyString(n.message_en, 1000) ||
      !isNonEmptyString(n.message_fa, 1000) ||
      !isNonEmptyString(n.created_at, 60)
    ) {
      throw new Error('رکورد نامعتبر در جدول اعلان‌ها (notifications) یافت شد.');
    }
    if (notifIds.has(n.id)) {
      throw new Error('شناسه تکراری در جدول اعلان‌ها وجود دارد.');
    }
    notifIds.add(n.id);
  }

  const auditIds = new Set<string>();
  for (const a of tables.audit_logs) {
    if (
      !a ||
      typeof a !== 'object' ||
      !isNonEmptyString(a.id, 100) ||
      !isNonEmptyString(a.user_id, 100) ||
      !isNonEmptyString(a.user_name, 160) ||
      !isNonEmptyString(a.user_role, 50) ||
      !isNonEmptyString(a.action, 80) ||
      !isNonEmptyString(a.entity_type, 80) ||
      !isNonEmptyString(a.entity_id, 120) ||
      !isNonEmptyString(a.summary, 1000) ||
      !isNonEmptyString(a.created_at, 60)
    ) {
      throw new Error('رکورد نامعتبر در جدول گزارش امنیت (audit_logs) یافت شد.');
    }
    if (auditIds.has(a.id)) {
      throw new Error('شناسه تکراری در جدول گزارش امنیت وجود دارد.');
    }
    auditIds.add(a.id);
  }

  return pkg as ShopinoBackupPackage;
}

export function restoreDatabaseSnapshot(
  rawPayload: unknown,
  actingOwner: { id: string; name: string; name_fa: string; email: string; role: string }
): { safetyBackupPath: string; restoredCounts: Record<BackupTableName, number> } {
  // 1. Validate structure, schema, referential integrity, and SHA-256 checksum BEFORE touching DB
  const validated = validateBackupPackage(rawPayload);
  const { tables } = validated;

  // 2. Create and verify a pre-restore safety backup of the current database on disk
  const safetyBackupPath = createVerifiedDatabaseBackup('pre-restore');

  // 3. Execute atomic restoration inside a single SQLite transaction
  runTransaction(() => {
    const existingUsers = queryAll<{
      id: string;
      name: string;
      name_fa: string;
      email: string;
      password_hash: string;
      role: string;
      status: string;
      last_login: string | null;
      created_at: string;
    }>('SELECT * FROM users');

    const hashById = new Map<string, string>();
    const hashByEmail = new Map<string, string>();
    let currentOwnerRecord = existingUsers.find((u) => u.id === actingOwner.id);

    for (const u of existingUsers) {
      hashById.set(u.id, u.password_hash);
      hashByEmail.set(u.email.trim().toLowerCase(), u.password_hash);
    }

    // Clear business tables in dependency order
    executeSql('DELETE FROM order_items');
    executeSql('DELETE FROM payments');
    executeSql('DELETE FROM orders');
    executeSql('DELETE FROM inventory_movements');
    executeSql('DELETE FROM customer_notes');
    executeSql('DELETE FROM customers');
    executeSql('DELETE FROM products');
    executeSql('DELETE FROM notifications');
    executeSql('DELETE FROM settings');
    executeSql('DELETE FROM audit_logs');
    executeSql('DELETE FROM users');

    // Restore users while preserving existing password_hash values and guaranteeing the acting owner remains active
    const fallbackPasswordHash = hashPassword(crypto.randomBytes(24).toString('hex'));
    let ownerRestored = false;

    for (const u of tables.users) {
      const normEmail = u.email.trim().toLowerCase();
      const preservedHash =
        hashById.get(u.id) || hashByEmail.get(normEmail) || fallbackPasswordHash;
      const isActingOwner = u.id === actingOwner.id || normEmail === actingOwner.email.trim().toLowerCase();
      const effectiveRole = isActingOwner ? 'owner' : u.role;
      const effectiveStatus = isActingOwner ? 'active' : u.status || 'active';
      if (effectiveRole === 'owner' && effectiveStatus === 'active') {
        ownerRestored = true;
      }

      executeSql(
        `INSERT INTO users (id, name, name_fa, email, password_hash, role, status, last_login, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u.id,
          u.name,
          u.name_fa,
          normEmail,
          preservedHash,
          effectiveRole,
          effectiveStatus,
          u.last_login ?? null,
          u.created_at,
        ]
      );
    }

    // Ensure the currently authenticated owner account is never locked out after restore
    if (!ownerRestored && currentOwnerRecord) {
      executeSql(
        `INSERT OR REPLACE INTO users (id, name, name_fa, email, password_hash, role, status, last_login, created_at)
         VALUES (?, ?, ?, ?, ?, 'owner', 'active', ?, ?)`,
        [
          currentOwnerRecord.id,
          currentOwnerRecord.name,
          currentOwnerRecord.name_fa,
          currentOwnerRecord.email,
          currentOwnerRecord.password_hash,
          currentOwnerRecord.last_login,
          currentOwnerRecord.created_at,
        ]
      );
    }

    // Prune any sessions belonging to users that no longer exist
    executeSql('DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users)');

    for (const s of tables.settings) {
      executeSql('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }

    for (const c of tables.customers) {
      executeSql(
        `INSERT INTO customers (id, code, name, phone, email, address, customer_type, tags, notes, status, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.code,
          c.name,
          c.phone ?? '',
          c.email ?? '',
          c.address ?? '',
          c.customer_type || 'retail',
          c.tags ?? '[]',
          c.notes ?? '',
          c.status || 'active',
          c.is_demo ? 1 : 0,
          c.created_at,
          c.updated_at,
        ]
      );
    }

    for (const cn of tables.customer_notes) {
      executeSql(
        `INSERT INTO customer_notes (id, customer_id, author_name, note, reminder_date, is_completed, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cn.id,
          cn.customer_id,
          cn.author_name,
          cn.note,
          cn.reminder_date ?? null,
          cn.is_completed ? 1 : 0,
          cn.is_demo ? 1 : 0,
          cn.created_at,
        ]
      );
    }

    for (const p of tables.products) {
      executeSql(
        `INSERT INTO products (id, sku, name, name_fa, category, description, notes, unit, cost_price_cents, sale_price_cents, wholesale_price_cents, stock_quantity, min_stock_threshold, product_type, status, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.sku.trim().toUpperCase(),
          p.name,
          p.name_fa || p.name,
          p.category || 'عمومی',
          p.description ?? '',
          p.notes ?? '',
          p.unit || 'piece',
          p.cost_price_cents,
          p.sale_price_cents,
          p.wholesale_price_cents,
          p.stock_quantity,
          p.min_stock_threshold,
          p.product_type || 'physical',
          p.status || 'active',
          p.is_demo ? 1 : 0,
          p.created_at,
          p.updated_at,
        ]
      );
    }

    for (const o of tables.orders) {
      executeSql(
        `INSERT INTO orders (id, order_number, customer_id, pricing_type, order_date, due_date, status, subtotal_cents, item_discount_cents, order_discount_cents, tax_cents, final_total_cents, cost_total_cents, notes, inventory_deducted, created_by, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          o.id,
          o.order_number,
          o.customer_id ?? null,
          o.pricing_type || 'retail',
          o.order_date,
          o.due_date ?? o.order_date,
          o.status,
          o.subtotal_cents,
          o.item_discount_cents,
          o.order_discount_cents,
          o.tax_cents,
          o.final_total_cents,
          o.cost_total_cents,
          o.notes ?? '',
          o.inventory_deducted ? 1 : 0,
          o.created_by,
          o.is_demo ? 1 : 0,
          o.created_at,
          o.updated_at,
        ]
      );
    }

    for (const oi of tables.order_items) {
      executeSql(
        `INSERT INTO order_items (id, order_id, product_id, product_name, sku, quantity, unit_price_cents, unit_cost_cents, discount_cents, tax_rate, tax_cents, line_total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.product_name,
          oi.sku,
          oi.quantity,
          oi.unit_price_cents,
          oi.unit_cost_cents,
          oi.discount_cents,
          Number(oi.tax_rate || 0),
          oi.tax_cents ?? 0,
          oi.line_total_cents,
        ]
      );
    }

    for (const pay of tables.payments) {
      executeSql(
        `INSERT INTO payments (id, payment_number, customer_id, order_id, payment_date, amount_cents, payment_type, payment_method, reference_number, notes, provider_confirmed, recorded_by, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pay.id,
          pay.payment_number,
          pay.customer_id ?? null,
          pay.order_id ?? null,
          pay.payment_date,
          pay.amount_cents,
          pay.payment_type || 'collection',
          pay.payment_method || 'card',
          pay.reference_number ?? '',
          pay.notes ?? '',
          pay.provider_confirmed !== undefined ? (pay.provider_confirmed ? 1 : 0) : 1,
          pay.recorded_by,
          pay.is_demo ? 1 : 0,
          pay.created_at,
        ]
      );
    }

    for (const m of tables.inventory_movements) {
      executeSql(
        `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, actor_name, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          m.product_id,
          m.movement_type,
          m.quantity_change,
          m.previous_stock,
          m.new_stock,
          m.reference_id ?? '',
          m.reason,
          m.actor_name,
          m.is_demo ? 1 : 0,
          m.created_at,
        ]
      );
    }

    for (const n of tables.notifications) {
      executeSql(
        `INSERT INTO notifications (id, type, title_en, title_fa, message_en, message_fa, target_route, is_read, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          n.id,
          n.type,
          n.title_en,
          n.title_fa,
          n.message_en,
          n.message_fa,
          n.target_route ?? '/dashboard',
          n.is_read ? 1 : 0,
          n.is_demo ? 1 : 0,
          n.created_at,
        ]
      );
    }

    for (const a of tables.audit_logs) {
      executeSql(
        `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id,
          a.user_id,
          a.user_name,
          a.user_role,
          a.action,
          a.entity_type,
          a.entity_id,
          a.summary,
          a.created_at,
        ]
      );
    }
  });

  const restoredCounts: Record<BackupTableName, number> = {
    settings: tables.settings.length,
    users: tables.users.length,
    customers: tables.customers.length,
    customer_notes: tables.customer_notes.length,
    products: tables.products.length,
    orders: tables.orders.length,
    order_items: tables.order_items.length,
    payments: tables.payments.length,
    inventory_movements: tables.inventory_movements.length,
    notifications: tables.notifications.length,
    audit_logs: tables.audit_logs.length,
  };

  return { safetyBackupPath, restoredCounts };
}


