# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: assetTrack.spec.js >> AssetTrack Critical Flows >> Asset Registration Flow
- Location: tests/e2e/assetTrack.spec.js:5:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:5173/inventory/undefined"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e6]:
      - img [ref=e8]
      - generic [ref=e11]:
        - generic [ref=e12]: AssetTrack
        - generic [ref=e14]: IT Operations
    - navigation [ref=e15]:
      - generic [ref=e16]: Navigation
      - link "Dashboard" [ref=e17] [cursor=pointer]:
        - /url: /
        - img [ref=e18]
        - generic [ref=e23]: Dashboard
      - link "Inventory" [ref=e24] [cursor=pointer]:
        - /url: /inventory
        - img [ref=e25]
        - generic [ref=e29]: Inventory
      - link "Barcode Scanner" [ref=e30] [cursor=pointer]:
        - /url: /scanner
        - img [ref=e31]
        - generic [ref=e37]: Barcode Scanner
      - link "Employees" [ref=e38] [cursor=pointer]:
        - /url: /employees
        - img [ref=e39]
        - generic [ref=e44]: Employees
      - link "Settings" [ref=e45] [cursor=pointer]:
        - /url: /settings
        - img [ref=e46]
        - generic [ref=e49]: Settings
    - generic [ref=e50]:
      - generic [ref=e51]:
        - generic [ref=e52]: System Status
        - generic [ref=e53]: Online
      - paragraph [ref=e55]: Connected to local DB
  - generic [ref=e56]:
    - banner [ref=e57]:
      - generic [ref=e58]:
        - heading "Asset Details" [level=1] [ref=e59]
        - generic [ref=e60]:
          - img [ref=e61]
          - textbox "Search assets by serial or name..." [ref=e64]
      - generic [ref=e65]:
        - link "Add Asset" [ref=e66] [cursor=pointer]:
          - /url: /inventory/new
          - img [ref=e67]
          - generic [ref=e68]: Add Asset
        - button [ref=e70]:
          - img [ref=e71]
        - generic [ref=e75]:
          - generic [ref=e76]: RS
          - generic [ref=e77]:
            - generic [ref=e78]: Rajan Sharma
            - generic [ref=e79]: IT Administrator
    - main [ref=e80]:
      - generic [ref=e82]:
        - img [ref=e84]
        - heading "Asset Record Not Found" [level=3] [ref=e90]
        - paragraph [ref=e91]: Request failed with status code 400
        - button "Return to Inventory" [ref=e92] [cursor=pointer]
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | test.describe('AssetTrack Critical Flows', () => {
  4  |   
  5  |   test('Asset Registration Flow', async ({ page }) => {
  6  |     // 1. Go to Inventory page
  7  |     await page.goto('/inventory');
  8  |     
  9  |     // 2. Click Add Asset button
  10 |     await page.click('text=Add Asset');
  11 |     
  12 |     // Wait for the navigation
  13 |     await page.waitForURL('/inventory/new');
  14 | 
  15 |     // 3. Fill the form
  16 |     await page.fill('input[id="asset-name"]', 'Playwright Test Laptop');
  17 |     // Assuming category ID 1 is Laptops (we'll select the first option with value)
  18 |     await page.selectOption('select[id="asset-category"]', { index: 1 });
  19 |     await page.selectOption('select[id="asset-loc"]', 'Bangalore');
  20 |     await page.fill('input[id="asset-serial"]', `TEST-SN-${Date.now()}`);
  21 |     
  22 |     // Submit the form
  23 |     await page.click('button[type="submit"]');
  24 | 
  25 |     // 4. Verify successful registration by checking the toast or URL
  26 |     // It should navigate to /inventory/:id
> 27 |     await page.waitForURL(/\/inventory\/\d+/);
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  28 |     await expect(page.locator('text=Playwright Test Laptop')).toBeVisible();
  29 |   });
  30 | 
  31 |   test('Employee Search & Asset Assignment', async ({ page }) => {
  32 |     // Start at Employees page
  33 |     await page.goto('/employees');
  34 |     
  35 |     // Wait for employees to load
  36 |     await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  37 | 
  38 |     // The test database is seeded with "Alice Smith"
  39 |     // Let's go back to inventory and assign an asset to an employee
  40 |     await page.goto('/inventory');
  41 |     
  42 |     // Wait for assets to load
  43 |     await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  44 |     
  45 |     // Click the first asset's Detail button
  46 |     const detailButtons = page.locator('text=Detail');
  47 |     if (await detailButtons.count() > 0) {
  48 |       await detailButtons.first().click();
  49 |       
  50 |       // Ensure we're on the detail page
  51 |       await page.waitForURL(/\/inventory\/\d+/);
  52 | 
  53 |       // Verify page loaded
  54 |       await expect(page.locator('text=Hardware Specifications')).toBeVisible({ timeout: 10000 });
  55 |     }
  56 |   });
  57 |   
  58 |   test('Search and Filter Flow', async ({ page }) => {
  59 |     await page.goto('/inventory');
  60 |     
  61 |     // Type in the search box
  62 |     await page.fill('input[placeholder*="Search by asset name"]', 'MacBook');
  63 |     
  64 |     // There should be some debounce, wait for network or just simple timeout
  65 |     await page.waitForTimeout(500);
  66 | 
  67 |     // Verify results
  68 |     const rows = page.locator('table tbody tr');
  69 |     // We just check that the table doesn't crash
  70 |     if (await rows.count() > 0) {
  71 |       await expect(rows.first()).toBeVisible();
  72 |     }
  73 |   });
  74 | 
  75 | });
  76 | 
```