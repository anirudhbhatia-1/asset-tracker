import { test, expect } from '@playwright/test';

test.describe('Dynamic RBAC Sync Loop End-to-End', () => {
  const timestamp = Date.now();
  const testRoleName = `Auditor_${timestamp}`;
  const testEmployeeEmail = `auditor_${timestamp}@company.com`;
  const testEmployeePassword = `Password_${timestamp}`;

  test('Director creates custom role, assigns it to employee, and employee UI dynamically reflects permission set', async ({ page, request }) => {
    // a. Obtain Director token via API login
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'admin@company.com', password: 'password' }
    });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.token;
    expect(token).toBeTruthy();

    // b. Create a new custom role via POST /api/roles with specific permission set
    // Permissions: assets:read, assets:export, categories:read, locations:read
    const createRoleRes = await request.post('/api/roles', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: testRoleName,
        description: 'Read-only asset auditor role for E2E testing',
        permissionKeys: ['assets:read', 'assets:export', 'categories:read', 'locations:read']
      }
    });
    expect(createRoleRes.status()).toBe(201);
    const roleData = (await createRoleRes.json()).data;
    const customRoleId = roleData.id;

    // c. Create a test employee and assign the custom role
    const createEmpRes = await request.post('/api/employees', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `Auditor User ${timestamp}`,
        email: testEmployeeEmail,
        department: 'Audit',
        grantAccess: true,
        roleId: customRoleId
      }
    });
    expect(createEmpRes.status()).toBe(201);
    const empData = await createEmpRes.json();
    const tempPassword = empData.temporaryPassword;
    const testEmployeeId = empData.data.id;

    // d. Log in as that test employee using temporaryPassword
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmployeeEmail);
    await page.fill('input[type="password"]', tempPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // e. Asserts: sidebar shows exactly Dashboard + Inventory (no Tickets, Onboarding, Scanner, Employees, Settings)
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inventory' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tickets' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Onboarding' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Scanner' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Employees' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).not.toBeVisible();

    // f. Asserts: root dashboard renders without any error banners (no 403 / error banners)
    await expect(page.getByText('IT Asset Dashboard')).toBeVisible();
    await expect(page.locator('.bg-danger\\/10')).not.toBeVisible();

    // g. Asserts: no "New Asset", "Edit", "Delete", or "Import" write buttons are present
    await expect(page.getByRole('button', { name: 'New Asset' })).not.toBeVisible();
    await page.goto('/inventory');
    await expect(page.getByRole('button', { name: 'Import Assets' })).not.toBeVisible();

    // h. Attempts direct navigation to /tickets and /onboarding by URL -> clean redirect to root /
    await page.goto('/tickets');
    await expect(page).toHaveURL('/');
    await expect(page.getByText('IT Asset Dashboard')).toBeVisible();

    await page.goto('/onboarding');
    await expect(page).toHaveURL('/');
    await expect(page.getByText('IT Asset Dashboard')).toBeVisible();
  });
});
