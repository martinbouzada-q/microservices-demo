import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Capture "before" screenshots for visual regression testing
 * Shows current state of add-to-cart UI before implementation
 */
async function captureBeforeScreenshots() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
  const screenshotDir = path.join(__dirname, '../screenshots/before');

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    console.log('📸 Capturing before screenshots...\n');

    // Screenshot 1: Product page with Add to Cart button (current state)
    console.log('1. Product page (OLJCESPC7Z)...');
    await page.goto(`${baseUrl}/product/OLJCESPC7Z`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(screenshotDir, '01-product-page.png'),
      fullPage: true,
    });
    console.log('   ✅ Saved: 01-product-page.png');

    // Screenshot 2: Add to Cart button close-up
    console.log('2. Add to Cart button detail...');
    const button = await page.locator('button:has-text("Add to Cart")').first();
    if (button) {
      await button.screenshot({
        path: path.join(screenshotDir, '02-add-to-cart-button.png'),
      });
      console.log('   ✅ Saved: 02-add-to-cart-button.png');
    }

    // Screenshot 3: Cart badge in header (current state)
    console.log('3. Cart badge in header...');
    const cartBadge = await page.locator('.cart-badge, [class*="badge"][class*="cart"]').first();
    if (cartBadge) {
      await cartBadge.screenshot({
        path: path.join(screenshotDir, '03-cart-badge-header.png'),
      });
      console.log('   ✅ Saved: 03-cart-badge-header.png');
    }

    // Screenshot 4: Mobile viewport (375px)
    console.log('4. Product page - Mobile (375px)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${baseUrl}/product/OLJCESPC7Z`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(screenshotDir, '04-product-page-mobile.png'),
      fullPage: true,
    });
    console.log('   ✅ Saved: 04-product-page-mobile.png');

    // Screenshot 5: Tablet viewport (768px)
    console.log('5. Product page - Tablet (768px)...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${baseUrl}/product/OLJCESPC7Z`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(screenshotDir, '05-product-page-tablet.png'),
      fullPage: true,
    });
    console.log('   ✅ Saved: 05-product-page-tablet.png');

    // Screenshot 6: Home page with cart
    console.log('6. Home page...');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(screenshotDir, '06-home-page.png'),
      fullPage: true,
    });
    console.log('   ✅ Saved: 06-home-page.png');

    // Screenshot 7: Product list page
    console.log('7. Product list page...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    const firstProductLink = await page.locator('a[href*="/product/"]').first();
    if (firstProductLink) {
      await firstProductLink.screenshot({
        path: path.join(screenshotDir, '07-product-list.png'),
      });
      console.log('   ✅ Saved: 07-product-list.png');
    }

    console.log('\n✅ All before screenshots captured successfully!');
    console.log(`📁 Location: ${screenshotDir}\n`);

    // Create index file
    const indexPath = path.join(screenshotDir, 'INDEX.md');
    const indexContent = `# Before Screenshots

Captured: ${new Date().toISOString()}

## Current State (Before Implementation)

| Screenshot | Description | Notes |
|-----------|-------------|-------|
| 01-product-page.png | Full product page (OLJCESPC7Z) | Shows current Add to Cart button state |
| 02-add-to-cart-button.png | Button close-up | No loading state, spinner, or feedback visible |
| 03-cart-badge-header.png | Cart badge in header | Static, updates only on page reload |
| 04-product-page-mobile.png | Mobile (375px viewport) | Current responsive design |
| 05-product-page-tablet.png | Tablet (768px viewport) | Current responsive design |
| 06-home-page.png | Home page overview | Shows general layout |
| 07-product-list.png | Product list detail | Shows product cards |

## Expected Changes (After Implementation)

After SCRUM-5 implementation:
- [ ] Add to Cart button will show loading spinner
- [ ] Toast notification will appear (success/error)
- [ ] Cart badge will update in real-time
- [ ] No page navigation after adding to cart
- [ ] Mobile layout remains responsive

## Visual Regression Test Strategy

1. Capture after-screenshots using same coordinates/viewports
2. Compare pixel differences with 5% threshold
3. Review any visual changes to confirm they're intentional
4. Update baselines if design changes are approved
`;

    fs.writeFileSync(indexPath, indexContent);
    console.log('📋 Created INDEX.md for before screenshots\n');
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the capture
captureBeforeScreenshots().catch(console.error);
