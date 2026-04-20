import { test, expect } from '@playwright/test';
import { ProductPage, CartPage } from '../pages';

/**
 * SCRUM-5: Improve Visual Feedback for Add-to-Cart Actions
 *
 * Tests all acceptance criteria scenarios using Page Object Model.
 * Bugs detected during static analysis:
 *   - SCRUM-20: cartSize uses len() instead of sum of quantities
 *   - SCRUM-21: case mismatch breaks keyboard/Enter submit interception
 *   - SCRUM-22: window.scrollTo() fires on every success (unexpected scroll)
 */

const PRODUCT_ID = 'OLJCESPC7Z'; // Sunglasses

test.describe('SCRUM-5: Add-to-Cart Visual Feedback', () => {
  let productPage: ProductPage;
  let cartPage: CartPage;

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    productPage = new ProductPage(page);
    cartPage = new CartPage(page);
    await productPage.navigate(PRODUCT_ID);
  });

  // ── Scenario 1: Confirmation + badge update ───────────────────────────────

  test.describe('Scenario 1: User sees confirmation after adding product', () => {
    test('SC1-A: Success toast appears after clicking Add To Cart', async () => {
      await productPage.clickAddToCart();
      const toast = await productPage.getToastSuccessMessage();
      expect(toast.toLowerCase()).toMatch(/added|cart/i);
    });

    test('SC1-B: Cart badge increments after adding 1 item', async () => {
      const before = await productPage.getCartBadgeCount();
      await productPage.clickAddToCart();
      const after = await productPage.getCartBadgeCount();
      expect(after).toBe(before + 1);
    });

    /**
     * @bug SCRUM-20 — cartSize returns len(items) not sum(quantities).
     * When quantity=2, badge shows 1 instead of 2.
     */
    test('SC1-C: Cart badge increments by selected quantity (qty=2) [SCRUM-20]', async () => {
      const before = await productPage.getCartBadgeCount();
      await productPage.selectQuantity(2);
      await productPage.clickAddToCart();
      const after = await productPage.getCartBadgeCount();
      expect(after).toBe(before + 2); // FAILS due to SCRUM-20: shows before+1
    });

    test('SC1-D: Page stays on product page after AJAX add (no redirect)', async () => {
      await productPage.clickAddToCart();
      expect(productPage.isOnProductPage()).toBe(true);
    });
  });

  // ── Scenario 2: Error handling ────────────────────────────────────────────

  test.describe('Scenario 2: Error when service unavailable', () => {
    test('SC2-A: Error toast appears when /api/cart/add returns 500', async ({ page }) => {
      // Intercept the AJAX call and simulate server error
      await page.route('**/api/cart/add', route =>
        route.fulfill({ status: 500, body: JSON.stringify({ success: false, error: 'Service unavailable', retryable: true }) })
      );

      await productPage.navigate(PRODUCT_ID);
      await productPage.clickAddToCart();

      const toast = page.locator('.toast-error, [class*="toast"][class*="error"]');
      await expect(toast).toBeVisible();
    });

    test('SC2-B: Cart badge does NOT update on error', async ({ page }) => {
      await page.route('**/api/cart/add', route =>
        route.fulfill({ status: 500, body: JSON.stringify({ success: false, error: 'Service unavailable', retryable: true }) })
      );

      await productPage.navigate(PRODUCT_ID);
      const before = await productPage.getCartBadgeCount();
      await productPage.clickAddToCart();
      const after = await productPage.getCartBadgeCount();
      expect(after).toBe(before);
    });

    test('SC2-C: Retry button appears after retryable error', async ({ page }) => {
      await page.route('**/api/cart/add', route =>
        route.fulfill({ status: 500, body: JSON.stringify({ success: false, error: 'Service unavailable', retryable: true }) })
      );

      await productPage.navigate(PRODUCT_ID);
      await productPage.clickAddToCart();

      const retryBtn = page.locator('button.toast-retry-btn, button:has-text("Retry")');
      await expect(retryBtn).toBeVisible();
    });
  });

  // ── Scenario 3: Button loading state ─────────────────────────────────────

  test.describe('Scenario 3: Button loading state during request', () => {
    test('SC3-A: Button becomes disabled immediately after click', async ({ page }) => {
      // Delay the AJAX response to observe loading state
      await page.route('**/api/cart/add', async route => {
        await new Promise(r => setTimeout(r, 300));
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true, cartSize: 1, message: 'Added 1 item(s) to cart' }) });
      });

      await productPage.navigate(PRODUCT_ID);
      const clickPromise = productPage.getAddToCartButton().click();

      // Check disabled state immediately after click
      await expect(productPage.getAddToCartButton()).toBeDisabled();
      await clickPromise;
    });

    test('SC3-B: Button re-enables after successful request', async () => {
      await productPage.clickAddToCart();
      await expect(productPage.getAddToCartButton()).toBeEnabled();
    });

    test('SC3-C: Spinner element is present in button DOM', async () => {
      await expect(productPage.getButtonSpinner()).toBeAttached();
    });
  });

  // ── Scenario 4: Debouncing rapid clicks ───────────────────────────────────

  test.describe('Scenario 4: Rapid clicks send only 1 request', () => {
    test('SC4-A: 3 rapid clicks result in exactly 1 API call', async ({ page }) => {
      let requestCount = 0;
      await page.route('**/api/cart/add', async route => {
        requestCount++;
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true, cartSize: requestCount, message: 'Added' }) });
      });

      await productPage.navigate(PRODUCT_ID);
      const btn = productPage.getAddToCartButton();

      // 3 rapid clicks within ~50ms
      await btn.click();
      await btn.click();
      await btn.click();
      await page.waitForLoadState('networkidle');

      expect(requestCount).toBe(1);
    });
  });

  // ── Scenario 5: Keyboard / Accessibility ─────────────────────────────────

  test.describe('Scenario 5: Keyboard navigation triggers AJAX (not redirect)', () => {
    /**
     * @bug SCRUM-21 — JS checks 'Add to Cart' (lowercase) but button has 'Add To Cart' (uppercase T).
     * Pressing Enter triggers form submit which is NOT intercepted → redirects to /cart.
     */
    test('SC5-A: Pressing Enter on Add To Cart button stays on product page [SCRUM-21]', async ({ page }) => {
      await productPage.navigate(PRODUCT_ID);
      await productPage.getAddToCartButton().focus();
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');

      // FAILS due to SCRUM-21: page redirects to /cart
      expect(productPage.isOnProductPage()).toBe(true);
    });

    test('SC5-B: Enter key triggers success toast (AJAX flow) [SCRUM-21]', async ({ page }) => {
      await productPage.navigate(PRODUCT_ID);
      await productPage.getAddToCartButton().focus();
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');

      // FAILS due to SCRUM-21: no toast, redirect happens instead
      const toast = page.locator('.toast-success, [class*="toast"][class*="success"]');
      await expect(toast).toBeVisible();
    });

    test('SC5-C: ARIA live region announces cart addition', async ({ page }) => {
      await productPage.navigate(PRODUCT_ID);
      const ariaLive = page.locator('[aria-live="polite"], [aria-live="assertive"]').first();
      await expect(ariaLive).toBeAttached();
      await productPage.clickAddToCart();
      // Toast container should have aria-live
      const toastContainer = page.locator('#toast-container[aria-live]');
      await expect(toastContainer).toBeAttached();
    });
  });

  // ── Scenario 6: No unexpected scroll ─────────────────────────────────────

  test.describe('Scenario 6: Page position not disturbed after add-to-cart', () => {
    /**
     * @bug SCRUM-22 — window.scrollTo({ top: 0 }) fires on every success.
     * User gets scrolled to top unexpectedly.
     */
    test('SC6-A: Scroll position unchanged after adding to cart [SCRUM-22]', async ({ page }) => {
      await productPage.navigate(PRODUCT_ID);

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 500));
      const scrollBefore = await page.evaluate(() => window.scrollY);
      expect(scrollBefore).toBeGreaterThan(0);

      await productPage.clickAddToCart();

      // Wait a moment for any scroll animation to complete
      await page.waitForTimeout(600);
      const scrollAfter = await page.evaluate(() => window.scrollY);

      // FAILS due to SCRUM-22: scrollAfter is 0
      expect(scrollAfter).toBeGreaterThan(0);
    });
  });

  // ── Scenario 7: Cross-browser & Regression ───────────────────────────────

  test.describe('Scenario 7: Regression — existing cart flow not broken', () => {
    test('SC7-A: After AJAX add, navigating to /cart shows the product', async () => {
      await productPage.clickAddToCart();
      await cartPage.navigate();
      expect(await cartPage.getCartItemCount()).toBeGreaterThan(0);
    });

    test('SC7-B: Adding same product twice accumulates quantity', async ({ page }) => {
      const before = await productPage.getCartBadgeCount();
      await productPage.clickAddToCart();
      await productPage.navigate(PRODUCT_ID); // reload product page
      await productPage.clickAddToCart();
      const after = await productPage.getCartBadgeCount();
      expect(after).toBeGreaterThanOrEqual(before + 2);
    });
  });
});
