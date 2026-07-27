import { test, expect } from '@playwright/test';

test.describe('Inventory flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@company.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should create a new asset successfully', async ({ page }) => {
    // 1. Go to inventory page
    await page.goto('/inventory');

    // 2. Click "Add Asset" button
    await page.getByRole('link', { name: 'Add Asset' }).first().click();

    // 3. Fill in required fields
    await page.fill('#assetName', 'Playwright Test Laptop');
    
    // We assume the first option has value "1" or we can just pick it by label if available.
    // Let's just wait for the select to be enabled.
    const select = page.locator('#categoryId');
    await expect(select).toBeEnabled();
    
    // Select index 1 (the first actual category if 0 is the placeholder)
    await page.locator('#categoryId').selectOption({ index: 1 });

    await page.locator('#location').selectOption('Bangalore');
    await page.fill('#serialNumber', `TEST-SN-${Date.now()}`);

    // 4. Submit form
    await page.getByRole('button', { name: 'Register Asset' }).click();

    // 5. Verify success navigation or toast (We should land on the detail page)
    await expect(page).toHaveURL(/\/inventory\/\d+/);
    await expect(page.getByText('Hardware asset registered successfully')).toBeVisible();
  });

  test('should show validation errors when creating asset with empty fields', async ({ page }) => {
    await page.goto('/inventory/new');
    await page.getByRole('button', { name: 'Register Asset' }).click();

    await expect(page.getByText('Asset name is required.')).toBeVisible();
    await expect(page.getByText('Please select a category.')).toBeVisible();
    await expect(page.getByText('Serial number is required.')).toBeVisible();
  });
});
