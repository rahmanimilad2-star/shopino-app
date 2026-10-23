import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';

// Run server in test mode so importing server.ts does not bind port 3000
process.env.SHOPINO_TEST_MODE = '1';
process.env.SESSION_SECRET = 'shopino-isolated-security-test-secret-2026';
const TEST_DB_PATH = path.resolve(process.cwd(), 'data', 'test-security.sqlite');
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.ALLOW_DEMO_LOGIN = 'true';

function cleanupTestDbFiles() {
  const dir = path.dirname(TEST_DB_PATH);
  const base = path.basename(TEST_DB_PATH);

  if (!fs.existsSync(dir)) return;

  for (const name of fs.readdirSync(dir)) {
    if (name === base || name.startsWith(`${base}.tmp.`)) {
      fs.unlinkSync(path.join(dir, name));
    }
  }
}

async function runSecuritySuite() {
  cleanupTestDbFiles();

  const dbMod = await import('./db.ts');
  const serverMod = await import('../../server.ts');

  const app = await serverMod.createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  let passed = 0;
  async function step(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed += 1;
      console.log(`  PASS  ${name}`);
    } catch (err) {
      console.error(`  FAIL  ${name}`);
      throw err;
    }
  }

  async function api(
    endpoint: string,
    opts: { method?: string; token?: string; body?: any; rawBody?: string; headers?: Record<string, string> } = {}
  ) {
    const headers: Record<string, string> = { ...(opts.headers || {}) };
    if (opts.token) {
      headers['Authorization'] = `Bearer ${opts.token}`;
    }
    if (opts.body !== undefined || opts.rawBody !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.rawBody !== undefined ? opts.rawBody : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, headers: res.headers, data };
  }

  try {
    console.log('\n=== Shopino Security & Production Hardening Test Suite ===\n');

    await step('1. HTTP security headers & malformed JSON handling', async () => {
      const cfg = await api('/api/auth/config');
      assert.equal(cfg.status, 200);
      assert.equal(cfg.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(cfg.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.ok(cfg.headers.get('content-security-policy')?.includes('frame-ancestors'));
      assert.equal(cfg.headers.get('cache-control'), 'no-store');

      const badJson = await api('/api/auth/login', {
        method: 'POST',
        rawBody: '{"email": "broken',
      });
      assert.equal(badJson.status, 400);
      assert.ok(badJson.data.error);
    });

    let ownerToken = '';
    await step('2. Authentication: valid login, invalid password rejection, and hashed session storage', async () => {
      const badLogin = await api('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@sellerhub.io', password: 'WrongPassword123' },
      });
      assert.equal(badLogin.status, 401);

      const goodLogin = await api('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@sellerhub.io', password: 'SellerHub@2026' },
      });
      assert.equal(goodLogin.status, 200);
      assert.ok(goodLogin.data.token);
      assert.equal(goodLogin.data.user.role, 'owner');
      assert.equal(goodLogin.data.user.password_hash, undefined);
      ownerToken = goodLogin.data.token;

      // Verify raw token is NOT stored in plaintext in the sessions table
      const rawSession = dbMod.queryOne('SELECT * FROM sessions WHERE token = ?', [ownerToken]);
      assert.equal(rawSession, undefined, 'Plaintext session token must not be stored in DB');

      const hashedToken = dbMod.hashSessionToken(ownerToken);
      const hashedSession = dbMod.queryOne('SELECT * FROM sessions WHERE token = ?', [hashedToken]);
      assert.ok(hashedSession, 'HMAC-SHA256 hashed session token must exist in DB');
    });

    await step('3. Legacy SHA-256 password hash compatibility & transparent upgrade to scrypt', async () => {
      const legacyHash = dbMod.legacyHashPassword('LegacyPass@2026');
      dbMod.executeSql(
        `INSERT INTO users (id, name, name_fa, email, password_hash, role, status, created_at)
         VALUES ('usr_legacy', 'Legacy User', 'کاربر قدیمی', 'legacy@sellerhub.io', ?, 'sales', 'active', ?)`,
        [legacyHash, new Date().toISOString()]
      );

      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        body: { email: 'legacy@sellerhub.io', password: 'LegacyPass@2026' },
      });
      assert.equal(loginRes.status, 200);

      const updatedUser = dbMod.queryOne<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = ?',
        ['usr_legacy']
      );
      assert.ok(
        updatedUser?.password_hash.startsWith('scrypt$'),
        'Legacy SHA-256 hash should automatically upgrade to salted scrypt on login'
      );
    });

    await step('4. Session expiration and logout invalidation', async () => {
      // Create an already-expired session
      const expiredRaw = 'tok_expired_test_12345';
      dbMod.executeSql(
        'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
        [
          dbMod.hashSessionToken(expiredRaw),
          'usr_owner',
          new Date(Date.now() - 60_000).toISOString(),
          new Date(Date.now() - 120_000).toISOString(),
        ]
      );

      const expRes = await api('/api/auth/me', { token: expiredRaw });
      assert.equal(expRes.status, 401);

      const pruned = dbMod.queryOne('SELECT * FROM sessions WHERE token = ?', [
        dbMod.hashSessionToken(expiredRaw),
      ]);
      assert.equal(pruned, undefined, 'Expired session should be deleted on access');

      // Test logout invalidation
      const tempLogin = await api('/api/auth/login', {
        method: 'POST',
        body: { email: 'legacy@sellerhub.io', password: 'LegacyPass@2026' },
      });
      const tempToken = tempLogin.data.token;
      const logoutRes = await api('/api/auth/logout', { method: 'POST', token: tempToken });
      assert.equal(logoutRes.status, 200);

      const afterLogout = await api('/api/auth/me', { token: tempToken });
      assert.equal(afterLogout.status, 401);
    });

    await step('5. Brute-force login rate limiting', async () => {
      serverMod.resetRateLimitsForTests();
      for (let i = 0; i < 8; i++) {
        const r = await api('/api/auth/login', {
          method: 'POST',
          body: { email: 'admin@sellerhub.io', password: 'WrongPassword!' },
        });
        assert.equal(r.status, 401);
      }
      const blocked = await api('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@sellerhub.io', password: 'SellerHub@2026' },
      });
      assert.equal(blocked.status, 429, '9th login attempt within window must be rate-limited with 429');
      serverMod.resetRateLimitsForTests();
    });

    await step('6. Production mode blocks unauthorized demo-role login and demo reset', async () => {
      process.env.ALLOW_DEMO_LOGIN = 'false';
      try {
        const cfg = await api('/api/auth/config');
        assert.equal(cfg.data.allowDemoLogin, false);

        const demoAttempt = await api('/api/auth/demo-role', {
          method: 'POST',
          body: { role: 'owner' },
        });
        assert.equal(demoAttempt.status, 403, 'Demo login must return 403 when ALLOW_DEMO_LOGIN=false');

        const resetAttempt = await api('/api/settings/reset-demo', {
          method: 'POST',
          token: ownerToken,
          body: { confirm: true },
        });
        assert.equal(resetAttempt.status, 403, 'Reset demo data must return 403 when ALLOW_DEMO_LOGIN=false');
      } finally {
        process.env.ALLOW_DEMO_LOGIN = 'true';
      }
    });

    await step('7. Profile & password update security (requires currentPassword & blocks role escalation)', async () => {
      const salesDemo = await api('/api/auth/demo-role', {
        method: 'POST',
        body: { role: 'sales' },
      });
      assert.equal(salesDemo.status, 200);
      const salesToken = salesDemo.data.token;

      // Attempt password change without currentPassword
      const noCurPass = await api('/api/auth/profile', {
        method: 'PUT',
        token: salesToken,
        body: {
          name: 'Sara Sales',
          email: 'sales@sellerhub.io',
          newPassword: 'NewStrongPassword@2026',
        },
      });
      assert.equal(noCurPass.status, 400);

      // Attempt password change with wrong currentPassword
      const wrongCurPass = await api('/api/auth/profile', {
        method: 'PUT',
        token: salesToken,
        body: {
          name: 'Sara Sales',
          email: 'sales@sellerhub.io',
          currentPassword: 'WrongCurrentPassword',
          newPassword: 'NewStrongPassword@2026',
        },
      });
      assert.equal(wrongCurPass.status, 401);

      // Attempt role privilege escalation in profile update -> must be rejected with 403 and logged
      const escalationAttempt = await api('/api/auth/profile', {
        method: 'PUT',
        token: salesToken,
        body: {
          name: 'Sara Sales',
          email: 'sales@sellerhub.io',
          role: 'owner',
        },
      });
      assert.equal(escalationAttempt.status, 403, 'Privilege escalation attempt must be rejected with 403');
      const meCheck = await api('/api/auth/me', { token: salesToken });
      assert.equal(meCheck.data.user.role, 'sales', 'User role must remain sales');
    });

    await step('8. Role-Based Access Control (RBAC) across all 5 roles', async () => {
      const getRoleToken = async (role: string) => {
        const r = await api('/api/auth/demo-role', { method: 'POST', body: { role } });
        assert.equal(r.status, 200);
        return r.data.token as string;
      };

      const salesToken = await getRoleToken('sales');
      const inventoryToken = await getRoleToken('inventory');
      const accountantToken = await getRoleToken('accountant');
      const managerToken = await getRoleToken('manager');

      const firstProd = dbMod.queryOne<any>('SELECT * FROM products WHERE status = \'active\' LIMIT 1');
      const customersList = dbMod.queryAll<any>('SELECT * FROM customers WHERE status = \'active\' LIMIT 2');
      const firstCust = customersList[0];
      const secondCust = customersList[1];

      // Sales restrictions
      assert.equal((await api('/api/reports', { token: salesToken })).status, 403);
      assert.equal(
        (await api('/api/products', { method: 'POST', token: salesToken, body: { name: 'X', sale_price: 1000 } })).status,
        403
      );
      assert.equal(
        (await api('/api/inventory/adjust', { method: 'POST', token: salesToken, body: { product_id: firstProd.id, quantity_change: 5 } })).status,
        403
      );
      assert.equal((await api(`/api/customers/${firstCust.id}`, { method: 'DELETE', token: salesToken })).status, 403);
      assert.equal((await api('/api/settings', { method: 'PUT', token: salesToken, body: {} })).status, 403);

      // Sales cost price stripping
      const salesProducts = await api('/api/products', { token: salesToken });
      assert.equal(salesProducts.status, 200);
      assert.equal(salesProducts.data.products[0].cost_price, undefined, 'Cost price must be hidden from sales role');

      // Inventory restrictions
      assert.equal((await api('/api/customers', { token: inventoryToken })).status, 403);
      assert.equal((await api('/api/payments', { token: inventoryToken })).status, 403);
      assert.equal((await api('/api/reports', { token: inventoryToken })).status, 403);
      assert.equal((await api('/api/orders', { method: 'POST', token: inventoryToken, body: {} })).status, 403);
      // Inventory allowed actions
      const invAdjust = await api('/api/inventory/adjust', {
        method: 'POST',
        token: inventoryToken,
        body: { product_id: firstProd.id, movement_type: 'addition', quantity_change: 2, reason: 'Test restock' },
      });
      assert.equal(invAdjust.status, 200);

      // Accountant restrictions & permissions
      assert.equal((await api('/api/reports', { token: accountantToken })).status, 200);
      assert.equal((await api('/api/payments', { token: accountantToken })).status, 200);
      assert.equal((await api('/api/orders', { method: 'POST', token: accountantToken, body: {} })).status, 403);
      assert.equal((await api('/api/products', { method: 'POST', token: accountantToken, body: {} })).status, 403);

      // Manager permissions & owner-only restrictions
      assert.equal((await api('/api/settings', { method: 'PUT', token: managerToken, body: { businessName: 'Shopino Pro' } })).status, 200);
      assert.equal(
        (await api('/api/settings/purge-demo', { method: 'POST', token: managerToken, body: { confirm: true } })).status,
        403,
        'Only owner can purge demo data'
      );
    });

    let createdOrderId = '';
    let primaryCustId = '';
    let secondaryCustId = '';

    await step('9. Authoritative order pricing, discount validation, and duplicate-line stock protection', async () => {
      const prdBefore = dbMod.queryOne<any>('SELECT * FROM products WHERE status = \'active\' AND stock_quantity >= 10 LIMIT 1');
      const custs = dbMod.queryAll<any>('SELECT * FROM customers WHERE status = \'active\' LIMIT 2');
      assert.ok(prdBefore);
      assert.ok(custs.length >= 2);
      primaryCustId = custs[0].id;
      secondaryCustId = custs[1].id;

      // Client attempts to tamper with unit_price = 1 Toman
      const tamperedOrder = await api('/api/orders', {
        method: 'POST',
        token: ownerToken,
        body: {
          customer_id: primaryCustId,
          pricing_type: 'retail',
          status: 'completed',
          order_discount: 50000,
          initial_payment_amount: 0,
          items: [
            {
              product_id: prdBefore.id,
              quantity: 2,
              unit_price: 1, // Tampered price! Server must ignore this and use catalog sale_price_cents
              discount: 0,
            },
          ],
        },
      });
      assert.equal(tamperedOrder.status, 201);
      createdOrderId = tamperedOrder.data.id;
      const expectedTotal = prdBefore.sale_price_cents * 2 - 50000;
      assert.equal(
        tamperedOrder.data.final_total,
        expectedTotal,
        'Server must compute order final_total from authoritative product catalog price, ignoring tampered client unit_price'
      );

      // Verify stock was deducted by 2
      const prdAfter = dbMod.queryOne<any>('SELECT * FROM products WHERE id = ?', [prdBefore.id]);
      assert.equal(prdAfter.stock_quantity, prdBefore.stock_quantity - 2);

      // Attempt to bypass stock check using duplicate lines of the same product in one order
      const available = prdAfter.stock_quantity;
      const halfPlusOne = Math.floor(available / 2) + 1;
      const dupLineBypass = await api('/api/orders', {
        method: 'POST',
        token: ownerToken,
        body: {
          customer_id: primaryCustId,
          pricing_type: 'retail',
          status: 'completed',
          items: [
            { product_id: prdBefore.id, quantity: halfPlusOne },
            { product_id: prdBefore.id, quantity: halfPlusOne },
          ],
        },
      });
      assert.equal(dupLineBypass.status, 400, 'Duplicate product lines exceeding total stock must be rejected');

      // Verify stock remained unchanged after rolled-back transaction
      const prdAfterRollback = dbMod.queryOne<any>('SELECT * FROM products WHERE id = ?', [prdBefore.id]);
      assert.equal(prdAfterRollback.stock_quantity, available);

      // Walk-in credit order must be rejected
      const walkInCredit = await api('/api/orders', {
        method: 'POST',
        token: ownerToken,
        body: {
          customer_id: null,
          pricing_type: 'retail',
          status: 'completed',
          initial_payment_amount: 0,
          items: [{ product_id: prdBefore.id, quantity: 1 }],
        },
      });
      assert.equal(walkInCredit.status, 400, 'Walk-in customer cannot buy on credit');
    });

    await step('10. Payment validation, order ownership check, overpayment protection & duplicate prevention', async () => {
      // Negative or fractional payment must be rejected
      const negPay = await api('/api/payments', {
        method: 'POST',
        token: ownerToken,
        body: { customer_id: primaryCustId, amount: -50000 },
      });
      assert.equal(negPay.status, 400);

      const fracPay = await api('/api/payments', {
        method: 'POST',
        token: ownerToken,
        body: { customer_id: primaryCustId, amount: 123.45 },
      });
      assert.equal(fracPay.status, 400);

      // Order belonging to primaryCustId cannot be paid under secondaryCustId
      const wrongCustPay = await api('/api/payments', {
        method: 'POST',
        token: ownerToken,
        body: { customer_id: secondaryCustId, order_id: createdOrderId, amount: 100000 },
      });
      assert.equal(wrongCustPay.status, 400);

      // Overpaying an order beyond its remaining balance must be rejected
      const overPay = await api('/api/payments', {
        method: 'POST',
        token: ownerToken,
        body: { customer_id: primaryCustId, order_id: createdOrderId, amount: 999_000_000, payment_type: 'collection' },
      });
      assert.equal(overPay.status, 400);

      // Valid payment followed by immediate duplicate submission within 5s
      const validPay = await api('/api/payments', {
        method: 'POST',
        token: ownerToken,
        body: {
          customer_id: primaryCustId,
          order_id: createdOrderId,
          amount: 100000,
          payment_type: 'collection',
          payment_method: 'card',
          reference_number: 'REF-DUP-TEST-1',
        },
      });
      assert.equal(validPay.status, 201);

      const dupPay = await api('/api/payments', {
        method: 'POST',
        token: ownerToken,
        body: {
          customer_id: primaryCustId,
          order_id: createdOrderId,
          amount: 100000,
          payment_type: 'collection',
          payment_method: 'card',
          reference_number: 'REF-DUP-TEST-1',
        },
      });
      assert.equal(dupPay.status, 409, 'Immediate duplicate payment within 5s must be blocked with 409');
    });

    console.log(`\nALL ${passed} SECURITY TESTS PASSED.\n`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    dbMod.closeAndResetDb();
    cleanupTestDbFiles();
  }
}

runSecuritySuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
