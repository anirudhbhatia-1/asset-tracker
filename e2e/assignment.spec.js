import { test, expect } from '@playwright/test';

// Uses the local development database's test accounts (npm run db).
const ADMIN = { email: 'admin@company.com', password: 'password' };
const ASSIGNEE_EMAIL = 'employee@company.com';

test.describe('Assignment flow', () => {
  let assetId;
  let apiToken;

  test.beforeEach(async ({ page, request }) => {
    // Create a fresh available asset so the test never depends on existing data.
    const login = await request.post('/api/auth/login', { data: ADMIN });
    expect(login.ok()).toBeTruthy();
    apiToken = (await login.json()).data.token;
    const created = await request.post('/api/assets', {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: 'E2E Assignment Laptop', serialNumber: `E2E-ASSIGN-${Date.now()}`, categoryId: 1, status: 'available' },
    });
    expect(created.ok()).toBeTruthy();
    assetId = (await created.json()).data.id;

    await page.goto('/login');
    await page.fill('input[type="email"]', ADMIN.email);
    await page.fill('input[type="password"]', ADMIN.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test.afterEach(async ({ request }) => {
    if (assetId) {
      await request.delete(`/api/assets/${assetId}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
        data: { confirm: true },
      });
    }
  });

  test('assigns an asset to an employee and returns it to stock', async ({ page }) => {
    await page.goto(`/inventory/${assetId}`);

    await page.getByRole('button', { name: 'Assign to Employee' }).click();
    await page.getByPlaceholder('Filter employees by name, email, or department...').fill(ASSIGNEE_EMAIL);
    await page.getByRole('button', { name: new RegExp(ASSIGNEE_EMAIL) }).click();
    await page.getByRole('button', { name: 'Assign Hardware' }).click();
    await expect(page.getByText('Asset assigned successfully')).toBeVisible();

    await page.getByRole('button', { name: 'Return to Stock' }).click();
    await page.getByRole('button', { name: 'Confirm Return' }).click();
    await expect(page.getByText('Asset returned to stock')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assign to Employee' })).toBeVisible();
  });
});
