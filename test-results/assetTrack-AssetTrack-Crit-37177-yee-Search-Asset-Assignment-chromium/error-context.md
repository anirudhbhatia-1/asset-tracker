# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: assetTrack.spec.js >> AssetTrack Critical Flows >> Employee Search & Asset Assignment
- Location: tests/e2e/assetTrack.spec.js:31:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Hardware Specifications')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Hardware Specifications')

```

```yaml
- complementary:
  - text: AssetTrack IT Operations
  - navigation:
    - text: Navigation
    - link "Dashboard":
      - /url: /
    - link "Inventory":
      - /url: /inventory
    - link "Barcode Scanner":
      - /url: /scanner
    - link "Employees":
      - /url: /employees
    - link "Settings":
      - /url: /settings
  - text: System Status Online
  - paragraph: Connected to local DB
- banner:
  - heading "Asset Details" [level=1]
  - textbox "Search assets by serial or name..."
  - link "Add Asset":
    - /url: /inventory/new
  - button
  - text: RS Rajan Sharma IT Administrator
- main:
  - link "Back to Hardware Inventory":
    - /url: /inventory
  - button "Refresh"
  - text: A
  - heading "Playwright Test Laptop" [level=2]
  - text: Audio & Headset Available Serial Number TEST-SN-1784886472329
  - button "Copy serial number"
  - text: Office Location Bangalore Purchase Cost $0.00 Purchase Date 2026-07-24 Operational & Audit Notes
  - button "Edit Notes"
  - text: No notes recorded for this asset yet.
  - heading "Lifecycle & Operational Controls" [level=3]
  - text: "Status: AVAILABLE"
  - button "Assign to Employee"
  - button "Retire Asset"
  - button "Delete"
  - heading "Audit History Timeline" [level=3]
  - text: 1 Event Asset Registered 5 minutes ago
  - paragraph: "Initial registration: Playwright Test Laptop"
  - paragraph: Performed by Rajan Sharma
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
  27 |     await page.waitForURL(/\/inventory\/\d+/);
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
> 54 |       await expect(page.locator('text=Hardware Specifications')).toBeVisible({ timeout: 10000 });
     |                                                                  ^ Error: expect(locator).toBeVisible() failed
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