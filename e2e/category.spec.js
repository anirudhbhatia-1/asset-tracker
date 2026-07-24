import { test, expect } from '@playwright/test';

test.describe('Category flow', () => {
  test('should create a new category', async ({ page }) => {
    // Navigate to settings -> categories
    await page.goto('/settings/categories');

    // Click 'Add Category'
    await page.getByRole('button', { name: 'Add Category' }).click();

    // Fill form
    const catName = `Test Category ${Date.now()}`;
    await page.fill('#catName', catName);
    await page.fill('#catDesc', 'This is an automated test category');
    
    // Save
    await page.getByRole('button', { name: 'Save Category' }).click();

    // Verify
    await expect(page.getByText('Category created successfully')).toBeVisible();
    await expect(page.getByText(catName)).toBeVisible();
  });
});
