import { test, expect } from '@playwright/test';

// Smoke-checks every main page at phone and desktop width, in light and dark
// theme: the page renders one title, nothing overflows sideways, and the
// browser console stays free of errors.
const PAGES = [
  '/', '/inventory', '/inventory?ownership=client', '/inventory/new', '/tickets',
  '/onboarding', '/scanner', '/employees', '/settings/roles', '/settings/categories',
  '/settings/locations', '/profile',
];
const VIEWPORTS = { phone: { width: 375, height: 812 }, desktop: { width: 1280, height: 900 } };
// Noise from the environment, not the app.
const IGNORED_CONSOLE = [/GSI_LOGGER/, /getUserMedia|NotAllowedError|Permission denied|camera/i, /React DevTools/];

let session;
test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/login', { data: { email: 'admin@company.com', password: 'password' } });
  expect(login.ok()).toBeTruthy();
  session = (await login.json()).data;
});

for (const theme of ['light', 'dark']) {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test(`pages render cleanly (${theme}, ${viewportName})`, async ({ browser }) => {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(([token, user, chosenTheme]) => {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', user);
        localStorage.setItem('assettrack-theme', chosenTheme);
      }, [session.token, JSON.stringify(session.user), theme]);
      const page = await context.newPage();
      const errors = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !IGNORED_CONSOLE.some((pattern) => pattern.test(message.text()))) {
          errors.push(`${page.url()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`));

      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('h1').first(), `${path} has a page title`).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
        if (theme === 'dark') {
          expect(await page.evaluate(() => document.documentElement.classList.contains('dark')), `${path} is dark`).toBe(true);
        }
      }
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}
