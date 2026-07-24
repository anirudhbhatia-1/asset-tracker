const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000); // wait for load
  await page.screenshot({ path: 'laptop_screenshot.png' });
  await browser.close();
})();
