import { test, expect } from '@playwright/test';

test.describe('Scanner & Unassigned Employee Role Fallback Repro Suite', () => {
  const timestamp = Date.now();
  const testRoleName = `ScanRole_${timestamp}`;
  const testEmployeeEmail = `scan_emp_${timestamp}@company.com`;

  test('Repro Step 1 & 2: Role with assets:read (no scanner:read) hides scanner, then updating to include scanner:read reveals scanner and permits scan endpoint', async ({ page, request }) => {
    // 1. Log in as Director to get token
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'admin@company.com', password: 'password' }
    });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.token;

    // 2. Create custom role with only assets:read (no scanner:read)
    const createRoleRes = await request.post('/api/roles', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: testRoleName,
        description: 'Role with assets:read only',
        permissionKeys: ['assets:read', 'categories:read', 'locations:read']
      }
    });
    expect(createRoleRes.status()).toBe(201);
    const roleId = (await createRoleRes.json()).data.id;

    // 3. Create employee assigned to this role
    const createEmpRes = await request.post('/api/employees', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `Scan Test Employee ${timestamp}`,
        email: testEmployeeEmail,
        grantAccess: true,
        roleId: roleId
      }
    });
    expect(createEmpRes.status()).toBe(201);
    const tempPassword = (await createEmpRes.json()).temporaryPassword;

    // 4. Log in fresh as test employee
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmployeeEmail);
    await page.fill('input[type="password"]', tempPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 5. Confirm Scanner nav is hidden and /scanner redirects
    await expect(page.getByRole('link', { name: 'Scanner' })).not.toBeVisible();
    await page.goto('/scanner');
    await expect(page).toHaveURL('/');

    // 6. Director updates role to add scanner:read
    const updateRoleRes = await request.put(`/api/roles/${roleId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        permissionKeys: ['assets:read', 'categories:read', 'locations:read', 'scanner:read']
      }
    });
    expect(updateRoleRes.status()).toBe(200);

    // 7. Log in fresh again as employee (session was invalidated on role update)
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmployeeEmail);
    await page.fill('input[type="password"]', tempPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 8. Confirm Scanner nav appears and /scanner route loads
    await expect(page.getByRole('link', { name: 'Scanner' })).toBeVisible();
    await page.goto('/scanner');
    await expect(page.getByRole('heading', { name: 'Barcode & Serial Scanner' })).toBeVisible();

    // 9. Confirm scan API endpoint returns 200/OK instead of 403
    const empLoginRes = await request.post('/api/auth/login', {
      data: { email: testEmployeeEmail, password: tempPassword }
    });
    const empToken = (await empLoginRes.json()).data.token;

    const scanRes = await request.get('/api/serial/scan/INVALID_SERIAL_123', {
      headers: { Authorization: `Bearer ${empToken}` }
    });
    expect(scanRes.status()).not.toBe(403);
  });

  test('Repro Step 3: Brand-new employee record with role_id NULL gets default employee role permissions on fresh login', async ({ page, request }) => {
    // Obtain Director token
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'admin@company.com', password: 'password' }
    });
    const token = (await loginRes.json()).data.token;

    const nullRoleEmail = `nullrole_${timestamp}@company.com`;

    // Create employee with grantAccess but explicitly no roleId (role_id NULL, role = 'employee')
    const createEmpRes = await request.post('/api/employees', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `Null Role User ${timestamp}`,
        email: nullRoleEmail,
        grantAccess: true,
        role: 'employee'
      }
    });
    expect(createEmpRes.status()).toBe(201);
    const tempPassword = (await createEmpRes.json()).temporaryPassword;

    // Log in fresh immediately
    await page.goto('/login');
    await page.fill('input[type="email"]', nullRoleEmail);
    await page.fill('input[type="password"]', tempPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // Confirm default employee nav (Tickets) is visible and app is not broken/empty
    await expect(page.getByRole('link', { name: 'Tickets' })).toBeVisible();
    await expect(page.getByText(/Welcome, Null Role User/)).toBeVisible();
  });
});
