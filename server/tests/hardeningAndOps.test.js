import express from 'express';
import request from 'supertest';
import { Writable } from 'stream';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import ExcelJS from 'exceljs';
import pinoHttp from 'pino-http';
import JSZip from 'jszip';
import bcrypt from 'bcrypt';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import app from '../index';
import db, { pool } from '../db';
import employeeService from '../services/employeeService';
import authService from '../services/authService';
import authRoutes from '../routes/auth';
import googleService from '../services/googleService';
import passwordPolicy from '../services/passwordPolicy';
import spreadsheetLimits from '../services/spreadsheetLimits';
import { importAssetsFromExcel } from '../services/importExportService';
import { readCsvRows } from '../services/csvImportService';
import security from '../middleware/security';
import buildInfo from '../buildInfo';
import loggerModule from '../logger';
import sentry from '../sentry';
import { parsePagination } from '../utils/pagination';

const createdIds = [];
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const director = { id: 0, role: 'director', isDirector: true, permissions: ['*'] };
const tokens = {};
const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
const tempFiles = [];

beforeAll(async () => {
  for (const [who, email] of [['director', 'admin@company.com'], ['admin', 'itadmin@company.com'], ['hr', 'hr@company.com'], ['employee', 'employee@company.com']]) {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
    tokens[who] = res.body.data.token;
  }
});

afterAll(async () => {
  await pool.query("DELETE FROM access_audit WHERE target_type = 'employee' AND target_id = ANY($1)", [createdIds]);
  await pool.query('DELETE FROM sessions WHERE employee_id = ANY($1)', [createdIds]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [createdIds]);
  await Promise.all(tempFiles.map((file) => unlink(file).catch(() => {})));
});

// An employee whose password is known (stored with a cheap, old-style hash).
const KNOWN_PASSWORD = 'Velvet-otter-29';
const accountWithPassword = async (cost = 4) => {
  const { employee } = await employeeService.createEmployeeWithAccess(
    { name: 'Lockout Person', email: `lockout.${unique()}@company.com`, roleId: 4 }, director,
  );
  createdIds.push(employee.id);
  await pool.query('UPDATE employees SET password_hash = $1, must_change_password = false WHERE id = $2',
    [await bcrypt.hash(KNOWN_PASSWORD, cost), employee.id]);
  return employee;
};
const accountState = async (id) => (await pool.query(
  'SELECT failed_login_count, locked_until, password_hash FROM employees WHERE id = $1', [id],
)).rows[0];

const lockedMessage = /^This account is locked after too many failed sign-ins\. Try again in \d+ minutes?, or ask an administrator to unlock it\.$/;
const lockedAuditRows = async (id) => (await pool.query(
  "SELECT * FROM access_audit WHERE event_type = 'account.locked' AND target_id = $1", [id],
)).rows;
const wrong = (email, ip) => authService.login(email, 'wrong-password', ip ? { ip } : {});

describe('per-account lockout', () => {
  it('locks after 20 wrong passwords within an hour, answers wrong guesses with 401 and the right one with 423', async () => {
    expect(authService.MAX_FAILED_LOGINS).toBe(20);
    expect(authService.FAILURE_WINDOW_MINUTES).toBe(60);
    const employee = await accountWithPassword();
    for (let attempt = 1; attempt <= 19; attempt += 1) {
      await expect(wrong(employee.email, '203.0.113.9'))
        .rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
    }
    expect((await accountState(employee.id)).failed_login_count).toBe(19);
    expect((await accountState(employee.id)).locked_until).toBeNull();

    // The attempt that locks the account still gets the generic answer.
    await expect(wrong(employee.email, '203.0.113.9'))
      .rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
    const state = await accountState(employee.id);
    expect(state.failed_login_count).toBe(0);
    expect(new Date(state.locked_until).getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

    // While locked, a wrong password looks like any other wrong password
    // (and isn't counted); only the right one learns about the lock.
    await expect(wrong(employee.email)).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
    expect((await accountState(employee.id)).failed_login_count).toBe(0);
    const right = authService.login(employee.email, KNOWN_PASSWORD);
    await expect(right).rejects.toMatchObject({ statusCode: 423, reason: 'ACCOUNT_LOCKED' });
    await expect(right).rejects.toThrow(
      'This account is locked after too many failed sign-ins. Try again in 15 minutes, or ask an administrator to unlock it.'
    );
    // The correct guess did not lift the lock.
    expect((await accountState(employee.id)).locked_until).toEqual(state.locked_until);

    const rows = await lockedAuditRows(employee.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: null, actor_name: 'System', target_name: employee.name });
    expect(rows[0].details).toMatchObject({ ip: '203.0.113.9', failedAttempts: 20, windowMinutes: 60, lockMinutes: 15 });

    // Visible on the employee, in the list and the detail.
    const detail = await request(app).get(`/api/employees/${employee.id}`).set(auth('director'));
    expect(detail.body.data.lockedUntil).toBeTruthy();
    const list = await request(app).get('/api/employees').set(auth('director'));
    expect(list.body.data.find((e) => e.id === employee.id).lockedUntil).toBeTruthy();
    expect(list.body.data.find((e) => e.email === 'hr@company.com').lockedUntil).toBeNull();

    // Through the route: right password 423 with a reason code, wrong one 401.
    const route = await request(app).post('/api/auth/login').send({ email: employee.email, password: KNOWN_PASSWORD });
    expect(route.status).toBe(423);
    expect(route.body).toMatchObject({ code: 423, reason: 'ACCOUNT_LOCKED' });
    expect(route.body.message).toMatch(lockedMessage);
    const routeWrong = await request(app).post('/api/auth/login').send({ email: employee.email, password: 'wrong-password' });
    expect(routeWrong.status).toBe(401);
    expect(routeWrong.body).toMatchObject({ message: 'Invalid email or password' });
    expect(routeWrong.body).not.toHaveProperty('reason');

    // Google sign-in is not blocked by the lock.
    await expect(googleService.loginWithGoogle('t', { verifyToken: async () => employee.email }))
      .resolves.toMatchObject({ token: expect.any(String) });

    // Without employees:grant-access it is refused; an Admin can unlock.
    expect((await request(app).post(`/api/employees/${employee.id}/unlock`).set(auth('employee'))).status).toBe(403);
    const unlock = await request(app).post(`/api/employees/${employee.id}/unlock`).set(auth('admin'));
    expect(unlock.status).toBe(200);
    expect(unlock.body.data).toMatchObject({ id: employee.id, lockedUntil: null });
    const unlockedRows = async () => (await pool.query(
      "SELECT * FROM access_audit WHERE event_type = 'account.unlocked' AND target_id = $1", [employee.id],
    )).rows;
    const unlocked = await unlockedRows();
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].new_value).toEqual({ lockedUntil: null });
    expect(unlocked[0].actor_id).not.toBeNull();

    // Unlocking an account that isn't locked succeeds but records nothing.
    const again = await request(app).post(`/api/employees/${employee.id}/unlock`).set(auth('admin'));
    expect(again.status).toBe(200);
    expect(await unlockedRows()).toHaveLength(1);

    await expect(authService.login(employee.email, KNOWN_PASSWORD)).resolves.toMatchObject({ token: expect.any(String) });
  });

  it('counts a burst of concurrent guesses exactly: one lock, one account.locked entry', async () => {
    const employee = await accountWithPassword();
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => wrong(employee.email)));
    expect(results.every((r) => r.status === 'rejected' && r.reason.statusCode === 401)).toBe(true);
    const state = await accountState(employee.id);
    expect(new Date(state.locked_until).getTime()).toBeGreaterThan(Date.now());
    expect(await lockedAuditRows(employee.id)).toHaveLength(1);

    // The right password in a later burst neither signs in nor lifts the lock.
    const burst = await Promise.allSettled([
      ...Array.from({ length: 5 }, () => wrong(employee.email)),
      authService.login(employee.email, KNOWN_PASSWORD),
    ]);
    expect(burst.slice(0, 5).every((r) => r.reason?.statusCode === 401)).toBe(true);
    expect(burst[5].reason).toMatchObject({ statusCode: 423 });
    expect((await accountState(employee.id)).locked_until).toEqual(state.locked_until);
    expect(await lockedAuditRows(employee.id)).toHaveLength(1);
  });

  it('a correct password checked while the account gets locked does not clear the lock', async () => {
    const employee = await accountWithPassword();
    const original = bcrypt.compare;
    // Simulates a concurrent guess locking the account while this sign-in's
    // password is being checked.
    const spy = vi.spyOn(bcrypt, 'compare').mockImplementation(async (plain, hash) => {
      const result = await original.call(bcrypt, plain, hash);
      if (plain === KNOWN_PASSWORD) {
        await pool.query("UPDATE employees SET locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $1", [employee.id]);
      }
      return result;
    });
    try {
      await expect(authService.login(employee.email, KNOWN_PASSWORD)).rejects.toMatchObject({ statusCode: 423 });
    } finally {
      spy.mockRestore();
    }
    expect(new Date((await accountState(employee.id)).locked_until).getTime()).toBeGreaterThan(Date.now());
  });

  it('starts the count again when the last failure is more than an hour old', async () => {
    const employee = await accountWithPassword();
    for (let attempt = 0; attempt < 19; attempt += 1) {
      await expect(wrong(employee.email)).rejects.toMatchObject({ statusCode: 401 });
    }
    await pool.query("UPDATE employees SET last_failed_login_at = NOW() - INTERVAL '61 minutes' WHERE id = $1", [employee.id]);
    await expect(wrong(employee.email)).rejects.toMatchObject({ statusCode: 401 });
    const state = await accountState(employee.id);
    expect(state.failed_login_count).toBe(1);
    expect(state.locked_until).toBeNull();
    expect(await lockedAuditRows(employee.id)).toHaveLength(0);
  });

  it('a successful sign-in resets the count; an expired lock no longer blocks', async () => {
    const employee = await accountWithPassword();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(authService.login(employee.email, 'nope-nope-nope')).rejects.toMatchObject({ statusCode: 401 });
    }
    expect((await accountState(employee.id)).failed_login_count).toBe(3);
    await authService.login(employee.email, KNOWN_PASSWORD);
    expect((await accountState(employee.id)).failed_login_count).toBe(0);

    await pool.query("UPDATE employees SET locked_until = NOW() - INTERVAL '1 minute' WHERE id = $1", [employee.id]);
    await expect(authService.login(employee.email, KNOWN_PASSWORD)).resolves.toBeTruthy();
    expect((await accountState(employee.id)).locked_until).toBeNull();
  });

  it('pads refused password sign-ins to the same minimum duration', async () => {
    const minMs = authRoutes.FAILED_LOGIN_MIN_MS;
    expect(minMs).toBeGreaterThanOrEqual(300);
    const employee = await accountWithPassword(4);
    const timed = async (body) => {
      const started = Date.now();
      const res = await request(app).post('/api/auth/login').send(body);
      return { status: res.status, ms: Date.now() - started };
    };
    const unknown = await timed({ email: `nobody.${unique()}@company.com`, password: 'whatever-123' });
    const cheapHash = await timed({ email: employee.email, password: 'wrong-password' });
    expect(unknown.status).toBe(401);
    expect(cheapHash.status).toBe(401);
    expect(unknown.ms).toBeGreaterThanOrEqual(minMs - 5);
    expect(cheapHash.ms).toBeGreaterThanOrEqual(minMs - 5);
  });

  it('keeps the generic message for unknown emails', async () => {
    await expect(authService.login(`nobody.${unique()}@company.com`, 'whatever-123'))
      .rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
  });

  it('cannot unlock a Director without being one', async () => {
    const res = await request(app).post('/api/employees/2/unlock').set(auth('admin'));
    expect(res.status).toBe(403);
    expect((await request(app).post('/api/employees/abc/unlock').set(auth('admin'))).status).toBe(400);
  });
});

describe('bcrypt cost', () => {
  it('upgrades an old cost-4 hash to cost 12 at the next successful sign-in', async () => {
    const employee = await accountWithPassword(4);
    await authService.login(employee.email, KNOWN_PASSWORD);
    const { password_hash: hash } = await accountState(employee.id);
    expect(bcrypt.getRounds(hash)).toBe(passwordPolicy.BCRYPT_COST);
    expect(passwordPolicy.BCRYPT_COST).toBe(12);
    expect(await bcrypt.compare(KNOWN_PASSWORD, hash)).toBe(true);
  });

  it('hashes generated temporary passwords at cost 12', async () => {
    const plain = await employeeService.createEmployee({ name: 'Cost Check', email: `cost.${unique()}@company.com` });
    createdIds.push(plain.id);
    const res = await request(app).post(`/api/employees/${plain.id}/grant-access`).set(auth('director')).send({ roleId: 4 });
    expect(res.status).toBe(200);
    expect(bcrypt.getRounds((await accountState(plain.id)).password_hash)).toBe(12);
  });
});

describe('password policy', () => {
  const problem = passwordPolicy.getPasswordProblem;
  it('enforces length, repetition, common passwords and personal details', () => {
    expect(problem('short-1')).toBe('The new password must be at least 10 characters long.');
    expect(problem('a'.repeat(129))).toBe('The new password must be at most 128 characters long.');
    expect(problem('zzzzzzzzzzzz')).toBe('The new password cannot be one character repeated.');
    expect(problem('1234567890')).toMatch(/too common/);
    expect(problem('Password123')).toMatch(/too common/);
    expect(problem('sunshine2026!')).toMatch(/too common/);
    expect(problem('ravi-loves-tea-42', { email: 'ravi.kumar@company.com' })).toBe('The new password must not contain your name or email address.');
    expect(problem('teaKUMARtime99', { name: 'Ravi Kumar' })).toMatch(/name or email/);
    // Parts shorter than four characters don't count.
    expect(problem('al-bo-lantern-77', { name: 'Al Bo' })).toBeNull();
    expect(problem('orbit-lantern-cascade-42', { email: 'ravi.kumar@company.com', name: 'Ravi Kumar' })).toBeNull();
  });

  it('falls back to a built-in list (and logs) when the common-password file is missing', () => {
    const list = passwordPolicy.loadCommonPasswords('/nonexistent/common-passwords.txt');
    expect(list.has('password')).toBe(true);
    expect(list.has('qwerty')).toBe(true);
    expect(passwordPolicy.isCommonPassword('Password2026!', list)).toBe(true);
    expect(passwordPolicy.isCommonPassword('orbit-lantern-cascade', list)).toBe(false);
    const fromFile = passwordPolicy.loadCommonPasswords(undefined, () => '# comment\nhunter2\n');
    expect([...fromFile]).toEqual(['hunter2']);
  });

  it('strips only ASCII digits and punctuation from the end before comparing', () => {
    const list = new Set(['sunshine', 'пароль', 'café']);
    expect(passwordPolicy.isCommonPassword('Sunshine2026!', list)).toBe(true);
    expect(passwordPolicy.isCommonPassword('sunshine_ _', list)).toBe(true);
    expect(passwordPolicy.isCommonPassword('пароль123', list)).toBe(true);
    expect(passwordPolicy.isCommonPassword('café99', list)).toBe(true);
    // Non-ASCII letters are part of the word, not a suffix to strip.
    expect(passwordPolicy.isCommonPassword('sunshineé', list)).toBe(false);
    expect(passwordPolicy.isCommonPassword('sunshineпароль', list)).toBe(false);
  });

  it('is applied by change-password with a 400', async () => {
    const employee = await accountWithPassword();
    const login = await request(app).post('/api/auth/login').send({ email: employee.email, password: KNOWN_PASSWORD });
    const change = (newPassword) => request(app).patch('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.data.token}`).send({ currentPassword: KNOWN_PASSWORD, newPassword });
    const weak = await change('password1');
    expect(weak.status).toBe(400);
    expect(weak.body.message).toBe('The new password must be at least 10 characters long.');
    const common = await change('qwertyuiop');
    expect(common.status).toBe(400);
    expect(common.body.message).toMatch(/too common/);
    const personal = await change('my-lockout-secret-1');
    expect(personal.status).toBe(400);
    expect(personal.body.message).toMatch(/name or email/);
    // Nothing changed: the old password still works.
    expect((await request(app).post('/api/auth/login').send({ email: employee.email, password: KNOWN_PASSWORD })).status).toBe(200);
  });
});

describe('security headers and rate limit', () => {
  it('sends helmet headers and a CSP allowing Google Identity Services, without HSTS outside production', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('script-src \'self\' https://accounts.google.com/gsi/client');
    expect(csp).toContain('frame-src https://accounts.google.com');
    expect(csp).toContain("connect-src 'self' https://accounts.google.com");
    expect(csp).toContain("img-src 'self' data: https:");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('adds HSTS in production', async () => {
    const prodApp = express();
    prodApp.use(security.securityHeaders({ NODE_ENV: 'production' }));
    prodApp.get('/x', (req, res) => res.json({}));
    const res = await request(prodApp).get('/x');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+; includeSubDomains/);
  });

  it('limits every /api request per IP but never /api/health', async () => {
    const small = express();
    small.use('/api', security.createApiLimiter({ limit: 2 }));
    small.get('/api/health', (req, res) => res.json({ ok: true }));
    small.get('/api/things', (req, res) => res.json({ ok: true }));
    expect((await request(small).get('/api/things')).status).toBe(200);
    expect((await request(small).get('/api/things')).status).toBe(200);
    const blocked = await request(small).get('/api/things');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.ratelimit).toBeDefined();
    for (let i = 0; i < 3; i += 1) expect((await request(small).get('/api/health')).status).toBe(200);
  });
});

describe('per-IP ceiling', () => {
  it('limits all /api requests from one IP even when every request sends a different token', async () => {
    const small = express();
    small.use('/api', security.createApiIpLimiter({ limit: 3 }), security.createApiLimiter({ limit: 100 }));
    small.get('/api/health', (req, res) => res.json({ ok: true }));
    small.get('/api/things', (req, res) => res.json({ ok: true }));
    const withFakeToken = () => request(small).get('/api/things')
      .set('Authorization', `Bearer fake-${unique()}-${'x'.repeat(30)}`);
    for (let i = 0; i < 3; i += 1) expect((await withFakeToken()).status).toBe(200);
    const blocked = await withFakeToken();
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Too many requests/);
    for (let i = 0; i < 3; i += 1) expect((await request(small).get('/api/health')).status).toBe(200);
  });

  it('defaults to 1200 a minute and reads API_RATE_LIMIT_IP_PER_MINUTE', async () => {
    const run = async (environment, count) => {
      const small = express();
      small.use('/api', security.createApiIpLimiter({}, environment));
      small.get('/api/things', (req, res) => res.json({ ok: true }));
      let last;
      for (let i = 0; i < count; i += 1) last = await request(small).get('/api/things');
      return last.status;
    };
    expect(await run({ API_RATE_LIMIT_IP_PER_MINUTE: '2' }, 3)).toBe(429);
    expect(await run({ API_RATE_LIMIT_IP_PER_MINUTE: '2' }, 2)).toBe(200);
    const policy = express();
    policy.use('/api', security.createApiIpLimiter({ standardHeaders: 'draft-7' }, {}));
    policy.get('/api/things', (req, res) => res.json({ ok: true }));
    expect((await request(policy).get('/api/things')).headers['ratelimit-policy']).toMatch(/^1200;w=60/);
  });
});

describe('health', () => {
  it('reports version, commit, start time and database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      version: buildInfo.version,
      commit: expect.any(String),
      startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      database: 'connected',
    });
  });

  it('reads the commit from GIT_COMMIT, then git, else unknown', () => {
    expect(buildInfo.readCommit({ GIT_COMMIT: 'abc1234' })).toBe('abc1234');
    expect(buildInfo.readCommit({}, () => Buffer.from('def5678\n'))).toBe('def5678');
    expect(buildInfo.readCommit({}, () => { throw new Error('no git'); })).toBe('unknown');
  });
});

describe('pagination', () => {
  it('keeps the full list without parameters and pages with limit/offset', async () => {
    for (const path of ['/api/tickets?scope=all', '/api/categories', '/api/offboarding']) {
      const sep = path.includes('?') ? '&' : '?';
      const full = await request(app).get(path).set(auth('director'));
      expect(full.status).toBe(200);
      expect(full.body.total).toBe(full.body.data.length);
      expect(full.body).not.toHaveProperty('limit');

      const page = await request(app).get(`${path}${sep}limit=1&offset=0`).set(auth('director'));
      expect(page.status).toBe(200);
      expect(page.body.total).toBe(full.body.total);
      expect(page.body.data).toEqual(full.body.data.slice(0, 1));
      expect(page.body).toMatchObject({ limit: 1, offset: 0 });

      const past = await request(app).get(`${path}${sep}limit=5&offset=100000`).set(auth('director'));
      expect(past.body).toMatchObject({ data: [], total: full.body.total });

      expect((await request(app).get(`${path}${sep}limit=0`).set(auth('director'))).status).toBe(400);
      expect((await request(app).get(`${path}${sep}limit=abc`).set(auth('director'))).status).toBe(400);
    }
    if ((await request(app).get('/api/categories').set(auth('director'))).body.total >= 2) {
      const second = await request(app).get('/api/categories?limit=1&offset=1').set(auth('director'));
      const full = await request(app).get('/api/categories').set(auth('director'));
      expect(second.body.data).toEqual(full.body.data.slice(1, 2));
    }
  });

  it('validates parameters', () => {
    expect(parsePagination({})).toBeNull();
    expect(parsePagination({ offset: '10' })).toEqual({ limit: 50, offset: 10 });
    expect(() => parsePagination({ limit: '501' })).toThrow(/between 1 and 500/);
    expect(() => parsePagination({ limit: '-1' })).toThrow();
  });
});

describe('spreadsheet import limits', () => {
  const xlsxFile = async (build) => {
    const workbook = new ExcelJS.Workbook();
    build(workbook);
    const filePath = join(tmpdir(), `limits-${process.pid}-${unique()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    tempFiles.push(filePath);
    return filePath;
  };

  it('rejects a workbook with more than 20 sheets before loading it', async () => {
    const filePath = await xlsxFile((wb) => { for (let i = 0; i < 21; i += 1) wb.addWorksheet(`S${i}`).addRow(['x']); });
    await expect(importAssetsFromExcel(filePath, director)).rejects.toMatchObject({
      statusCode: 400, message: expect.stringContaining('21 sheets; at most 20'),
    });
  });

  it('rejects a sheet with more than 10,000 data rows', async () => {
    const filePath = await xlsxFile((wb) => {
      const sheet = wb.addWorksheet('Laptops');
      sheet.addRow(['Serial Number']);
      for (let i = 0; i < 10001; i += 1) sheet.addRow([`S${i}`]);
    });
    await expect(importAssetsFromExcel(filePath, director)).rejects.toMatchObject({
      statusCode: 400, message: expect.stringContaining('more than 10,000 data rows'),
    });
  });

  it('inflates entries to check the real size, so forged small declared sizes do not help a zip bomb', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types/>');
    zip.file('xl/workbook.xml', '<workbook/>');
    zip.file('xl/worksheets/sheet1.xml', Buffer.alloc(5 * 1024 * 1024, 0x20));
    const bomb = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    expect(bomb.length).toBeLessThan(100 * 1024);
    // Patch every declared uncompressed size (local headers and central
    // directory) down to 10 bytes.
    for (let i = 0; i < bomb.length - 4; i += 1) {
      const sig = bomb.readUInt32LE(i);
      if (sig === 0x04034b50) bomb.writeUInt32LE(10, i + 22);
      if (sig === 0x02014b50) bomb.writeUInt32LE(10, i + 24);
    }
    const filePath = join(tmpdir(), `limits-${process.pid}-${unique()}.xlsx`);
    await writeFile(filePath, bomb);
    tempFiles.push(filePath);

    const loaded = await JSZip.loadAsync(bomb);
    // eslint-disable-next-line no-underscore-dangle
    expect(loaded.files['xl/worksheets/sheet1.xml']._data.uncompressedSize).toBe(10);
    await expect(spreadsheetLimits.checkXlsxStructure(filePath, { maxUncompressedBytes: 1024 * 1024 }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('too large to import once unpacked') });
    // Under a big enough cap the real size is reported.
    await expect(spreadsheetLimits.checkXlsxStructure(filePath, { maxUncompressedBytes: 10 * 1024 * 1024 }))
      .resolves.toMatchObject({ sheetCount: 1, uncompressedBytes: 5 * 1024 * 1024 + 8 + 11 });
  });

  it('accepts a normal workbook and measures its real size', async () => {
    const filePath = await xlsxFile((wb) => wb.addWorksheet('Laptops').addRow(['Serial Number']));
    const result = await spreadsheetLimits.checkXlsxStructure(filePath);
    expect(result.sheetCount).toBe(1);
    expect(result.uncompressedBytes).toBeGreaterThan(0);
  });

  it('rejects something that is not a workbook', async () => {
    const filePath = join(tmpdir(), `limits-${process.pid}-${unique()}.xlsx`);
    await writeFile(filePath, 'not a zip');
    tempFiles.push(filePath);
    await expect(spreadsheetLimits.checkXlsxStructure(filePath)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a CSV with more than 10,000 data rows while reading it', async () => {
    const filePath = join(tmpdir(), `limits-${process.pid}-${unique()}.csv`);
    await writeFile(filePath, `category,name\n${Array.from({ length: 10001 }, (_, i) => `Laptop,L${i}`).join('\n')}\n`);
    tempFiles.push(filePath);
    await expect(readCsvRows(filePath)).rejects.toMatchObject({
      statusCode: 400, message: expect.stringContaining('CSV file has more than 10,000'),
    });
  });
});

describe('operations', () => {
  it('warns about an unverified database certificate in production, or refuses with DATABASE_SSL_REQUIRE_CA', () => {
    expect(db.getSslCaProblem({ NODE_ENV: 'development' })).toBeNull();
    expect(db.getSslCaProblem({ NODE_ENV: 'production', DATABASE_SSL_CA_FILE: '/ca.pem' })).toBeNull();
    expect(db.getSslCaProblem({ NODE_ENV: 'production' })).toMatchObject({ fatal: false, message: expect.stringContaining('DATABASE_SSL_CA_FILE') });
    expect(db.getSslCaProblem({ NODE_ENV: 'production', DATABASE_SSL_REQUIRE_CA: 'true' }).fatal).toBe(true);
    expect(pool.options.connectionTimeoutMillis).toBe(Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000);
  });

  it('sets a statement timeout on database connections', async () => {
    expect(db.STATEMENT_TIMEOUT_MS).toBe(Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 30000);
    const client = await pool.connect();
    try {
      // Wait for the SET queued on connect, then read it back.
      const { rows: [row] } = await client.query('SHOW statement_timeout');
      expect(row.statement_timeout).toBe(db.STATEMENT_TIMEOUT_MS % 1000 === 0 ? `${db.STATEMENT_TIMEOUT_MS / 1000}s` : `${db.STATEMENT_TIMEOUT_MS}ms`);
    } finally {
      client.release();
    }
  });

  it('health check gives up on the database after a short timeout', async () => {
    expect(db.HEALTH_TIMEOUT_MS).toBe(2000);
    await expect(db.pingDatabase()).resolves.toBeTruthy();
    const hanging = { query: () => new Promise(() => {}) };
    const started = Date.now();
    await expect(db.pingDatabase(100, hanging)).rejects.toThrow(/did not answer within 100 ms/);
    expect(Date.now() - started).toBeLessThan(1000);
    const failing = { query: () => Promise.reject(new Error('ECONNREFUSED')) };
    await expect(db.pingDatabase(100, failing)).rejects.toThrow('ECONNREFUSED');
  });

  it('logs the client IP Express resolved (trust proxy), not the socket address', async () => {
    const lines = [];
    const sink = new Writable({ write(chunk, enc, cb) { lines.push(String(chunk)); cb(); } });
    const log = loggerModule.createLogger({ LOG_LEVEL: 'info' }, sink);
    const small = express();
    small.set('trust proxy', 1);
    small.use(pinoHttp({ logger: log, serializers: { req: loggerModule.serializeRequest } }));
    small.get('/x', (req, res) => res.json({}));
    await request(small).get('/x').set('X-Forwarded-For', '198.51.100.7');
    const entry = JSON.parse(lines.find((line) => line.includes('"req"')));
    expect(entry.req.ip).toBe('198.51.100.7');
    expect(entry.req).not.toHaveProperty('remoteAddress');
  });

  it('shuts down by closing the server, then the pool, then exiting', async () => {
    const order = [];
    const exit = vi.fn((code) => order.push(`exit:${code}`));
    const httpServer = { close: (cb) => { order.push('server'); cb(); }, closeIdleConnections: () => {} };
    const fakePool = { end: async () => { order.push('pool'); } };
    app.resetShutdownForTests();
    await app.shutdown('SIGTERM', { exit, httpServer, pool: fakePool });
    expect(order).toEqual(['server', 'pool', 'exit:0']);
    app.resetShutdownForTests();
  });

  it('redacts credentials from logs', () => {
    const lines = [];
    const sink = new Writable({ write(chunk, enc, cb) { lines.push(String(chunk)); cb(); } });
    const log = loggerModule.createLogger({ LOG_LEVEL: 'info' }, sink);
    log.info({ req: { headers: { authorization: 'Bearer secret-token', cookie: 'sid=1' } }, body: { password: 'hunter2-hunter2' } }, 'x');
    const output = lines.join('');
    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('sid=1');
    expect(output).not.toContain('hunter2');
    expect(output).toContain('[redacted]');
  });

  it('Sentry is a no-op without SENTRY_DSN', () => {
    expect(sentry.initSentry({})).toBe(false);
    expect(sentry.isEnabled()).toBe(false);
    expect(() => sentry.captureException(new Error('x'))).not.toThrow();
  });
});

describe('RBAC audit item: employees close or reopen their own resolved tickets', () => {
  it('lets the owner confirm-close and reopen, but not another employee', async () => {
    const ticketIds = [];
    const raise = async () => {
      const res = await request(app).post('/api/tickets').set(auth('employee')).send({ type: 'issue', title: `RBAC check ${unique()}` });
      expect(res.status).toBe(201);
      ticketIds.push(res.body.data.id);
      const resolved = await request(app).patch(`/api/tickets/${res.body.data.id}`).set(auth('director')).send({ status: 'resolved' });
      expect(resolved.status).toBe(200);
      return res.body.data.id;
    };
    try {
      const first = await raise();
      expect((await request(app).patch(`/api/tickets/${first}/confirm-close`).set(auth('hr'))).status).toBe(403);
      const closed = await request(app).patch(`/api/tickets/${first}/confirm-close`).set(auth('employee'));
      expect(closed.status).toBe(200);
      expect(closed.body.data.status).toBe('closed');

      const second = await raise();
      const reopened = await request(app).patch(`/api/tickets/${second}/reopen`).set(auth('employee')).send({ note: 'still broken' });
      expect(reopened.status).toBe(200);
      expect(reopened.body.data.status).toBe('open');
    } finally {
      await pool.query('DELETE FROM ticket_history WHERE ticket_id = ANY($1)', [ticketIds]);
      await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [ticketIds]);
    }
  });
});
