import { test, expect } from '@playwright/test';

test.describe('Services Views (Tickets, Onboarding, Locations)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@company.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should render Support Tickets view without errors', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.getByText('Support Tickets')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Raise Ticket' })).toBeVisible();
  });

  test('should render HR Onboarding view without errors', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.getByText('HR Onboarding')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Hire' })).toBeVisible();
  });

  test('should render Locations Tab view without errors', async ({ page }) => {
    await page.goto('/settings/locations');
    await expect(page.getByRole('heading', { name: 'Office Locations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Location' })).toBeVisible();
  });
});
