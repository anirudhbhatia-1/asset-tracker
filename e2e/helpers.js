import { expect } from '@playwright/test';

// New accounts get a temporary password that must be replaced at first
// login. Signs in, sets `newPassword` on the required screen, signs in again
// and returns the password to use from then on.
export const NEW_TEST_PASSWORD = 'e2e-new-password-1';

export async function loginReplacingTemporaryPassword(page, email, temporaryPassword, newPassword = NEW_TEST_PASSWORD) {
  await loginWithPassword(page, email, temporaryPassword);
  await expect(page.getByRole('heading', { name: 'Set a New Password' })).toBeVisible();
  await page.getByPlaceholder('Enter current password').fill(temporaryPassword);
  await page.getByPlaceholder('At least 8 characters').fill(newPassword);
  await page.getByPlaceholder('Type new password again').fill(newPassword);
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expect(page).toHaveURL(/\/login/);
  await loginWithPassword(page, email, newPassword);
  return newPassword;
}

export async function loginWithPassword(page, email, password) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
}
