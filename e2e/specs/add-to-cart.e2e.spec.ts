import { test, expect } from '../fixtures';
import { urls } from '../config/urls';
import { testProducts } from '../fixtures/data';
import { ProductPage, CartPage } from '../pages';

const product = testProducts.sunglasses;

const errorPayload = JSON.stringify({ success: false, error: 'Service unavailable', retryable: true });
const successPayload = (cartSize: number) =>
  JSON.stringify({ success: true, cartSize, message: 'Added 1 item(s) to cart' });

test.describe('Add-to-Cart Visual Feedback', () => {
  let productPage: ProductPage;
  let cartPage: CartPage;

  test.beforeEach(async ({ freshSession: page }) => {
    productPage = new ProductPage(page);
    cartPage = new CartPage(page);
    await productPage.goto(product.id);
  });

  test.describe('Confirmation and badge update', () => {
    test('shows success toast after click', async () => {
      await productPage.addToCart();
      await expect(productPage.successToast).toBeVisible();
      await expect(productPage.successToast).toContainText(/added|cart/i);
    });

    test('cart badge increments by one', async () => {
      const before = await productPage.cartBadgeCount();
      await productPage.addToCart();
      await expect.poll(() => productPage.cartBadgeCount()).toBe(before + 1);
    });

    test.fixme('cart badge increments by selected quantity (qty=2) [SCRUM-20]', async () => {
      const before = await productPage.cartBadgeCount();
      await productPage.selectQuantity(2);
      await productPage.addToCart();
      await expect.poll(() => productPage.cartBadgeCount()).toBe(before + 2);
    });

    test('stays on product page after AJAX add', async () => {
      await productPage.addToCart();
      expect(productPage.isOnProductPage()).toBe(true);
    });
  });

  test.describe('Error handling', () => {
    test.beforeEach(async ({ page }) => {
      await page.route(`**${urls.cartAddAjax}`, route =>
        route.fulfill({ status: 500, body: errorPayload }),
      );
      await productPage.goto(product.id);
    });

    test('shows error toast on 500', async ({ page }) => {
      await productPage.addToCart();
      await expect(page.locator('.toast-error')).toBeVisible();
    });

    test('badge does not change on error', async () => {
      const before = await productPage.cartBadgeCount();
      await productPage.addToCart();
      expect(await productPage.cartBadgeCount()).toBe(before);
    });

    test('retry button appears for retryable error', async ({ page }) => {
      await productPage.addToCart();
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    });
  });

  test.describe('Button loading state', () => {
    test('button disables while in flight', async ({ page }) => {
      await page.route(`**${urls.cartAddAjax}`, async route => {
        await new Promise(r => setTimeout(r, 300));
        await route.fulfill({ status: 200, body: successPayload(1) });
      });
      await productPage.goto(product.id);
      const click = productPage.addToCartButton.click();
      await expect(productPage.addToCartButton).toBeDisabled();
      await click;
    });

    test('button re-enables after success', async () => {
      await productPage.addToCart();
      await expect(productPage.addToCartButton).toBeEnabled();
    });

    test('spinner element exists in button DOM', async () => {
      await expect(productPage.buttonSpinner).toBeAttached();
    });
  });

  test.describe('Debouncing', () => {
    test('three rapid clicks send only one request', async ({ page }) => {
      let count = 0;
      await page.route(`**${urls.cartAddAjax}`, async route => {
        count++;
        await route.fulfill({ status: 200, body: successPayload(count) });
      });
      await productPage.goto(product.id);
      await productPage.addToCartButton.click();
      await productPage.addToCartButton.click();
      await productPage.addToCartButton.click();
      await page.waitForLoadState('networkidle');
      expect(count).toBe(1);
    });
  });

  test.describe('Keyboard / Accessibility', () => {
    test.fixme('Enter on Add To Cart triggers AJAX, stays on page [SCRUM-21]', async ({ page }) => {
      await productPage.addToCartButton.focus();
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
      expect(productPage.isOnProductPage()).toBe(true);
    });

    test('toast container has aria-live', async ({ page }) => {
      await productPage.addToCart();
      await expect(page.locator('#toast-container[aria-live]')).toBeAttached();
    });
  });

  test.describe('Scroll behavior', () => {
    test.fixme('scroll position preserved after add [SCRUM-22]', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, 500));
      const before = await page.evaluate(() => window.scrollY);
      expect(before).toBeGreaterThan(0);

      await productPage.addToCart();
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => window.scrollY);
      expect(after).toBeGreaterThan(0);
    });
  });

  test.describe('Regression', () => {
    test('item is visible on cart page after add', async () => {
      await productPage.addToCart();
      await cartPage.goto();
      expect(await cartPage.itemCount()).toBeGreaterThan(0);
    });

    test('adding twice accumulates quantity', async () => {
      const before = await productPage.cartBadgeCount();
      await productPage.addToCart();
      await productPage.goto(product.id);
      await productPage.addToCart();
      await expect.poll(() => productPage.cartBadgeCount()).toBeGreaterThanOrEqual(before + 2);
    });
  });
});
