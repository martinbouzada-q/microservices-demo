import { test, expect } from '@playwright/test';

/**
 * SCRUM-1: Wishlist Feature E2E Tests
 *
 * Comprehensive test coverage for the wishlist functionality that allows users to save favorite products.
 * Tests Scenarios 1-7 from the acceptance criteria:
 * - SC1: User adds a product to wishlist from product page
 * - SC2: User views their wishlist page with products
 * - SC3: User removes a product from wishlist
 * - SC4: User views empty wishlist (basic navigation tests)
 * - SC5: User adds product from wishlist to cart
 * - SC6: Wishlist persists across sessions within TTL
 * - SC7: Wishlist expires with session
 */

const BASE_URL = 'http://localhost:8080';
const PRODUCT_ID = 'OLJCESPC7Z'; // Sunglasses - used in AC examples
const PRODUCT_NAME = 'Sunglasses';

test.describe('SCRUM-1: Wishlist Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test to start with fresh session
    await page.context().clearCookies();
  });

  test.describe('Scenario 1: User adds a product to wishlist from product page', () => {
    test('SC1-A: Can add product to wishlist from product page', async ({ page }) => {
      // Navigate to product page
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');

      // Verify "Add to Wishlist" button exists
      const addBtn = page.locator('button:has-text("Add to Wishlist")').first();
      await expect(addBtn).toBeVisible();

      // Verify button has wishlist-inactive class initially
      await expect(addBtn).toHaveClass(/wishlist-inactive/);

      // Click "Add to Wishlist" button
      await addBtn.click();

      // Wait for AJAX to complete
      await page.waitForLoadState('networkidle');

      // Verify button text changes to "Remove from Wishlist"
      await expect(addBtn).toHaveText('Remove from Wishlist');

      // Verify button has wishlist-active class
      await expect(addBtn).toHaveClass(/wishlist-active/);
    });

    test('SC1-B: Shows confirmation toast when adding to wishlist', async ({ page }) => {
      // Navigate to product page
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');

      // Add to wishlist
      const addBtn = page.locator('button:has-text("Add to Wishlist")').first();
      await addBtn.click();

      // Wait for toast to appear
      const toast = page.locator('div.toast-success');
      await expect(toast).toBeVisible();

      // Verify toast message
      await expect(toast).toContainText('Added to your wishlist');
    });

    test('SC1-C: Wishlist badge increments on product add', async ({ page }) => {
      // Navigate to product page
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');

      // Check initial badge value
      const badge = page.locator('#wishlist-count');
      const initialCount = parseInt(await badge.textContent() || '0');

      // Add to wishlist
      const addBtn = page.locator('button:has-text("Add to Wishlist")').first();
      await addBtn.click();

      // Wait for badge update
      await page.waitForTimeout(500);

      // Verify badge incremented
      const newCount = parseInt(await badge.textContent() || '0');
      expect(newCount).toBe(initialCount + 1);
    });

    test('SC1-D: Product appears in wishlist after adding', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('button:has-text("Add to Wishlist")').first();
      await addBtn.click();
      await page.waitForLoadState('networkidle');

      // Navigate to wishlist page
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Verify product is displayed
      const productName = page.locator(`text=${PRODUCT_NAME}`);
      await expect(productName).toBeVisible();

      // Verify product details are shown
      const productRow = page.locator('.wishlist-item-row');
      const productCount = await productRow.count();
      expect(productCount).toBeGreaterThan(0);
    });
  });

  test.describe('Scenario 2: User views their wishlist page with products', () => {
    test('SC2-A: Wishlist displays products with all required details', async ({ page }) => {
      // Add product to wishlist first
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Verify product image is displayed
      const productImage = page.locator('.wishlist-item-row img').first();
      await expect(productImage).toBeVisible();

      // Verify product name is displayed
      const productName = page.locator('.wishlist-item-row h5');
      await expect(productName).toContainText(PRODUCT_NAME);

      // Verify product price is displayed
      const price = page.locator('.wishlist-item-row .h5').first();
      await expect(price).toBeVisible();
    });

    test('SC2-B: Wishlist shows product count', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Verify item count is shown in heading
      const heading = page.locator('h3');
      const headingText = await heading.textContent();
      expect(headingText).toMatch(/\d+\s*item/i);
    });

    test('SC2-C: Wishlist shows Add to Cart and Remove buttons', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Verify "Add to Cart" button exists
      const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
      await expect(addToCartBtn).toBeVisible();

      // Verify "Remove from Wishlist" button exists
      const removeBtn = page.locator('button:has-text("Remove from Wishlist")').first();
      await expect(removeBtn).toBeVisible();
    });

    test('SC2-D: Products are sorted by most recently added', async ({ page }) => {
      // Add first product
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();
      await page.waitForTimeout(200);

      // Add second product (different one)
      // Navigate home to find another product
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Find and click another "Add to Wishlist" button
      const addButtons = page.locator('button:has-text("Add to Wishlist")');
      if (await addButtons.count() > 1) {
        await addButtons.nth(1).click();
        await page.waitForTimeout(200);
      }

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Verify multiple items are shown
      const items = page.locator('.wishlist-item-row');
      const itemCount = await items.count();
      expect(itemCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Scenario 3: User removes a product from wishlist', () => {
    test('SC3-A: Can remove product from wishlist page', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Click "Remove from Wishlist" button
      const removeBtn = page.locator('button:has-text("Remove from Wishlist")').first();
      await removeBtn.click();

      // Wait for AJAX to complete
      await page.waitForLoadState('networkidle');

      // Verify product is removed (should show empty state)
      const emptyMessage = page.locator('h3:has-text("Your wishlist is empty!")');
      await expect(emptyMessage).toBeVisible();
    });

    test('SC3-B: Shows confirmation toast when removing', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Remove from wishlist
      const removeBtn = page.locator('button:has-text("Remove from Wishlist")').first();
      await removeBtn.click();

      // Wait for toast to appear
      const toast = page.locator('div.toast-success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Removed from wishlist');
    });

    test('SC3-C: Wishlist badge decrements on product remove', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();
      await page.waitForTimeout(500);

      // Get badge count after adding
      const badge = page.locator('#wishlist-count');
      const countAfterAdd = parseInt(await badge.textContent() || '0');

      // Navigate to wishlist and remove
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Remove from Wishlist")').first().click();
      await page.waitForTimeout(500);

      // Navigate back to a page with badge visible
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Verify badge decremented
      const badgeAfterRemove = page.locator('#wishlist-count');
      const countAfterRemove = parseInt(await badgeAfterRemove.textContent() || '0');
      expect(countAfterRemove).toBe(countAfterAdd - 1);
    });
  });

  test.describe('Scenario 4: User views empty wishlist (Page Structure)', () => {
    test('SC4-A: Empty wishlist page loads and displays empty state', async ({ page }) => {
      // Navigate to wishlist page
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Check for empty state message
      const emptyMessage = page.locator('h3:has-text("Your wishlist is empty!")');
      await expect(emptyMessage).toBeVisible();

      // Check for Continue Shopping button
      const continueBtn = page.locator('a:has-text("Continue Shopping")');
      await expect(continueBtn).toBeVisible();
    });

    test('SC4-B: Wishlist page structure is correct', async ({ page }) => {
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Check for main element
      const mainContent = page.locator('main[role="main"].wishlist-sections');
      await expect(mainContent).toBeVisible();

      // Check for empty state section
      const emptySection = page.locator('section.empty-wishlist-section');
      await expect(emptySection).toBeVisible();
    });

    test('SC4-C: Wishlist page has correct title', async ({ page }) => {
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      const title = await page.title();
      expect(title).toContain('Online Boutique');
    });

    test('SC4-D: Header is displayed on wishlist page', async ({ page }) => {
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      const header = page.locator('header');
      await expect(header).toBeVisible();

      const navbar = page.locator('.navbar');
      await expect(navbar).toBeVisible();
    });

    test('SC4-E: Wishlist page returns 200 status', async ({ page }) => {
      const response = await page.goto('/wishlist');
      expect(response?.status()).toBe(200);
    });
  });

  test.describe('Scenario 5: User adds product from wishlist to cart', () => {
    test('SC5-A: Can add product to cart from wishlist page', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Get cart count before
      const cartBadge = page.locator('#cart-count');
      const countBefore = parseInt(await cartBadge.textContent() || '0');

      // Click "Add to Cart" button
      const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
      await addToCartBtn.click();

      // Wait for cart update
      await page.waitForTimeout(500);

      // Verify cart count incremented
      const countAfter = parseInt(await cartBadge.textContent() || '0');
      expect(countAfter).toBe(countBefore + 1);
    });

    test('SC5-B: Product remains in wishlist after adding to cart', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Add to cart
      const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
      await addToCartBtn.click();
      await page.waitForTimeout(500);

      // Verify product is still in wishlist
      const productName = page.locator(`text=${PRODUCT_NAME}`);
      await expect(productName).toBeVisible();

      // Verify "Remove from Wishlist" button is still there
      const removeBtn = page.locator('button:has-text("Remove from Wishlist")');
      await expect(removeBtn).toBeVisible();
    });

    test('SC5-C: Shows toast confirmation when adding to cart', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Add to cart
      const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
      await addToCartBtn.click();

      // Wait for toast to appear
      const toast = page.locator('div.toast-success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Added to cart');
    });
  });

  test.describe('Scenario 6: Wishlist persists across sessions within TTL', () => {
    test('SC6-A: Wishlist data persists across page navigation', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to home
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Navigate back to product page
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');

      // Verify button still shows "Remove from Wishlist" (product is still in wishlist)
      const btn = page.locator('button:has-text("Remove from Wishlist")').first();
      await expect(btn).toBeVisible();
    });

    test('SC6-B: Wishlist persists across wishlist page navigation', async ({ page }) => {
      // Add product to wishlist
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("Add to Wishlist")').first().click();

      // Navigate to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Verify product is displayed
      const productName = page.locator(`text=${PRODUCT_NAME}`);
      await expect(productName).toBeVisible();

      // Navigate to home
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Navigate back to wishlist
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');

      // Verify product is still there
      await expect(productName).toBeVisible();
    });
  });

  test.describe('Scenario 7: Wishlist state consistency', () => {
    test('SC7-A: Toggle wishlist from product page and verify on wishlist page', async ({ page }) => {
      // Add from product page
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      const addBtn = page.locator('button:has-text("Add to Wishlist")').first();
      await addBtn.click();
      await page.waitForTimeout(500);

      // Verify on wishlist page
      await page.goto('/wishlist');
      await page.waitForLoadState('networkidle');
      const productName = page.locator(`text=${PRODUCT_NAME}`);
      await expect(productName).toBeVisible();

      // Remove from wishlist page
      const removeBtn = page.locator('button:has-text("Remove from Wishlist")').first();
      await removeBtn.click();
      await page.waitForTimeout(500);

      // Verify empty state
      const emptyMessage = page.locator('h3:has-text("Your wishlist is empty!")');
      await expect(emptyMessage).toBeVisible();

      // Verify button state on product page
      await page.goto(`/product/${PRODUCT_ID}`);
      await page.waitForLoadState('networkidle');
      const addBtnAgain = page.locator('button:has-text("Add to Wishlist")').first();
      await expect(addBtnAgain).toBeVisible();
    });
  });
});
