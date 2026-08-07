import { test, expect } from '@playwright/test';

test.describe('Director Dashboard flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@company.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should display Executive Super-Dashboard for System Director with view mode tabs', async ({ page }) => {
    // Verify Executive Super-Dashboard title
    await expect(page.getByText('Executive Super-Dashboard')).toBeVisible();
    await expect(page.getByText('System Director')).toBeVisible();

    // Verify view mode tabs
    await expect(page.getByRole('button', { name: 'Executive Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'IT Admin View' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'HR Partner View' })).toBeVisible();

    // Click HR Partner View tab
    await page.getByRole('button', { name: 'HR Partner View' }).click();
    await expect(page.getByText('Pending Onboardings')).toBeVisible();

    // Click Role Matrix Builder link
    await page.getByRole('link', { name: 'Role Matrix Builder' }).click();
    await expect(page).toHaveURL(/\/settings\/roles/);
  });
});
