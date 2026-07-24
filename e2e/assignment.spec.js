import { test, expect } from '@playwright/test';

test.describe('Assignment flow', () => {
  test('should allocate an asset to an employee and return it', async ({ page }) => {
    // We assume there's at least one available asset to assign
    await page.goto('/inventory');

    // Click on the first asset link in the table
    const firstAssetLink = page.locator('tbody tr a').first();
    await firstAssetLink.click();
    
    // Wait for detail page
    await expect(page).toHaveURL(/\/inventory\/\d+/);

    // Look for assign button
    const assignBtn = page.getByRole('button', { name: 'Allocate Asset' });
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      
      // In the modal, fill in details
      await page.fill('input[placeholder*="Search employee"]', 'a'); // trigger search
      // wait for results and click first employee
      await page.waitForTimeout(500); 
      const firstEmployeeBtn = page.locator('button', { hasText: '@' }).first();
      await firstEmployeeBtn.click();

      // Submit allocation
      await page.getByRole('button', { name: 'Confirm Allocation' }).click();

      // Verify success
      await expect(page.getByText('Asset allocated successfully')).toBeVisible();
    }

    // Now if it is assigned, look for return button
    const returnBtn = page.getByRole('button', { name: 'Return Asset' });
    if (await returnBtn.isVisible()) {
      await returnBtn.click();
      // wait for modal
      await page.getByRole('button', { name: 'Confirm Return' }).click();
      
      await expect(page.getByText('Asset returned successfully')).toBeVisible();
    }
  });
});
