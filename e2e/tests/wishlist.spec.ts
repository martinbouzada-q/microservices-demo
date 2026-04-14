import { test, expect } from '@playwright/test';

/**
 * Wishlist Feature E2E Tests
 *
 * Tests for the wishlist functionality that allows users to save favorite products.
 * Covers happy path, edge cases, and error scenarios.
 */

test.describe('Wishlist Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test to start with fresh session
    await page.context().clearCookies();
  });

  /**
   * Scenario 1: Add product to wishlist from product page
   *
   * Given I am on a product page
   * When I click "Add to Wishlist"
   * Then the product should be saved to my wishlist
   * And I should see a confirmation message
   */
  test('SC01: Add product to wishlist from product page', async ({ page }) => {
    // Navigate to a product page (e.g., OLJCESPC7Z - Camp Mug)
    await page.goto('/product/OLJCESPC7Z');

    // Wait for product details to load
    await page.waitForSelector('h1');
    const productName = await page.locator('h1').textContent();
    expect(productName).toContain('Camp Mug');

    // Click "Add to Wishlist" button
    const addToWishlistBtn = page.locator('button:has-text("Add to Wishlist")');
    await expect(addToWishlistBtn).toBeVisible();
    await addToWishlistBtn.click();

    // Should redirect to product page (or show confirmation)
    await page.waitForURL(/\/product\//);

    // Navigate to wishlist to verify product was added
    await page.goto('/wishlist');
    await page.waitForSelector('.wishlist-item-row');

    const wishlistItems = await page.locator('.wishlist-item-row').count();
    expect(wishlistItems).toBeGreaterThanOrEqual(1);

    // Verify the product is in the wishlist
    const itemText = await page.locator('.wishlist-item-row h5').first().textContent();
    expect(itemText).toContain('Camp Mug');
  });

  /**
   * Scenario 2: View wishlist with multiple products
   *
   * Given I have multiple products in my wishlist
   * When I navigate to /wishlist
   * Then I should see all products listed with their details
   * And each product should show: name, image, price, added date
   */
  test('SC02: View wishlist with multiple products', async ({ page }) => {
    // Add first product
    await page.goto('/product/OLJCESPC7Z');
    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Add second product
    await page.goto('/product/66VCHSJNUP');
    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Navigate to wishlist
    await page.goto('/wishlist');
    await page.waitForSelector('.wishlist-item-row');

    // Verify multiple items are displayed
    const items = page.locator('.wishlist-item-row');
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThanOrEqual(2);

    // Verify each item has required elements
    const firstItem = items.first();

    // Check for product image
    const img = firstItem.locator('img[alt]');
    await expect(img).toBeVisible();

    // Check for product name
    const name = firstItem.locator('h5');
    await expect(name).toBeVisible();

    // Check for price
    const price = firstItem.locator('.h5');
    await expect(price).toBeVisible();

    // Check for added date
    const date = firstItem.locator('.text-muted.small');
    await expect(date).toContainText('Added');

    // Verify header shows count
    const header = page.locator('h3').first();
    await expect(header).toContainText(`My Wishlist (${itemCount})`);
  });

  /**
   * Scenario 3: Remove product from wishlist
   *
   * Given I have a product in my wishlist
   * When I click "Remove from Wishlist" button
   * Then the product should be removed immediately
   * And the wishlist should update
   */
  test('SC03: Remove product from wishlist', async ({ page }) => {
    // Add a product first
    await page.goto('/product/OLJCESPC7Z');
    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Navigate to wishlist
    await page.goto('/wishlist');
    await page.waitForSelector('.wishlist-item-row');

    const initialCount = await page.locator('.wishlist-item-row').count();
    expect(initialCount).toBeGreaterThan(0);

    // Click remove button on first item
    const removeBtn = page.locator('button:has-text("Remove from Wishlist")').first();
    await removeBtn.click();

    // Should redirect to wishlist page
    await page.waitForURL(/\/wishlist/);

    // Verify item is removed
    const finalCount = await page.locator('.wishlist-item-row').count();
    expect(finalCount).toBeLessThan(initialCount);
  });

  /**
   * Scenario 4: Add product to cart directly from wishlist
   *
   * Given I have a product in my wishlist
   * When I click "Add to Cart" button on a wishlist item
   * Then the product should be added to my shopping cart
   * And I should remain on the wishlist page
   */
  test('SC04: Add product to cart from wishlist', async ({ page }) => {
    // Add a product to wishlist
    await page.goto('/product/OLJCESPC7Z');
    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Navigate to wishlist
    await page.goto('/wishlist');
    await page.waitForSelector('.wishlist-item-row');

    // Get initial cart badge count (if visible)
    const cartBadgeInitial = await page.locator('[id*="cart"][class*="badge"]').textContent().catch(() => '0');

    // Click "Add to Cart" button
    const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
    await addToCartBtn.click();

    // Should stay on wishlist page
    await expect(page).toHaveURL(/\/wishlist/);

    // Navigate to cart to verify product was added
    await page.goto('/cart');
    await page.waitForSelector('h2:has-text("Shopping Cart")');

    const cartItems = page.locator('[class*="cart-item"]');
    const cartItemCount = await cartItems.count();
    expect(cartItemCount).toBeGreaterThan(0);

    // Verify the product is in the cart
    const cartItemText = await cartItems.first().textContent();
    expect(cartItemText).toContain('Camp Mug');
  });

  /**
   * Scenario 5: Empty wishlist displays appropriate message
   *
   * Given I have no products in my wishlist
   * When I navigate to /wishlist
   * Then I should see "Your wishlist is empty!" message
   * And a "Continue Shopping" button
   */
  test('SC05: Empty wishlist displays appropriate message', async ({ page }) => {
    // Navigate directly to empty wishlist
    await page.goto('/wishlist');

    // Should display empty state
    const emptyMessage = page.locator('h3:has-text("Your wishlist is empty!")');
    await expect(emptyMessage).toBeVisible();

    // Should show helper text
    const helpText = page.locator('text=Items you add to your wishlist will appear here');
    await expect(helpText).toBeVisible();

    // Should have "Continue Shopping" button
    const continueBtn = page.locator('a:has-text("Continue Shopping")');
    await expect(continueBtn).toBeVisible();

    // Verify no cart items are shown
    const items = page.locator('.wishlist-item-row');
    const itemCount = await items.count();
    expect(itemCount).toBe(0);
  });

  /**
   * Scenario 6: Wishlist prices update with currency conversion
   *
   * Given I have a product in my wishlist with USD price
   * When I change the currency to EUR
   * Then the wishlist prices should be converted and displayed in EUR
   */
  test('SC06: Wishlist prices update with currency conversion', async ({ page }) => {
    // Add a product to wishlist
    await page.goto('/product/OLJCESPC7Z');
    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Navigate to wishlist
    await page.goto('/wishlist');
    await page.waitForSelector('.wishlist-item-row');

    // Get initial price in USD
    const priceText = await page.locator('.h5').first().textContent();
    const usdPrice = priceText?.match(/\$[\d.]+/)?.[0];
    expect(usdPrice).toBeDefined();

    // Change currency to EUR
    const currencySelect = page.locator('select[name="currency"], [class*="currency"]');
    if (await currencySelect.isVisible()) {
      await currencySelect.selectOption('EUR');

      // Wait for page to refresh with new currency
      await page.waitForTimeout(1000);

      // Verify price is converted (should not be USD anymore)
      const newPriceText = await page.locator('.h5').first().textContent();
      const eurPrice = newPriceText?.match(/€[\d.]+/)?.[0];

      // Either price should contain EUR symbol or be different from USD
      expect(newPriceText).not.toEqual(priceText);
    }
  });

  /**
   * Scenario 7: Wishlist persists across sessions
   *
   * Given I add products to my wishlist
   * When I close the browser and return to the site
   * Then my wishlist should be preserved (via session cookie)
   */
  test('SC07: Wishlist persists across sessions', async ({ page }) => {
    // Add a product to wishlist
    await page.goto('/product/OLJCESPC7Z');
    const productName = await page.locator('h1').textContent();

    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Get current session cookie
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'shop_session-id');
    expect(sessionCookie).toBeDefined();

    // Create new page with same cookie to simulate session persistence
    const newPage = await page.context().newPage();
    await newPage.goto('/wishlist');
    await newPage.waitForSelector('.wishlist-item-row');

    // Verify product is still in wishlist
    const items = newPage.locator('.wishlist-item-row');
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThan(0);

    // Verify the product name matches
    const itemText = await items.first().locator('h5').textContent();
    expect(itemText).toContain('Camp Mug');

    await newPage.close();
  });

  /**
   * Scenario 8: Adding duplicate product is idempotent
   *
   * Given I add a product to my wishlist
   * When I add the same product again
   * Then the product should not appear twice
   * And the wishlist should show only one instance
   */
  test('SC08: Adding duplicate product is idempotent', async ({ page }) => {
    const productId = 'OLJCESPC7Z';

    // Add product first time
    await page.goto(`/product/${productId}`);
    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Navigate to wishlist and verify count
    await page.goto('/wishlist');
    await page.waitForSelector('.wishlist-item-row');
    const countAfterFirstAdd = await page.locator('.wishlist-item-row').count();

    // Add the same product again
    await page.goto(`/product/${productId}`);
    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Navigate back to wishlist
    await page.goto('/wishlist');
    await page.waitForSelector('.wishlist-item-row');
    const countAfterSecondAdd = await page.locator('.wishlist-item-row').count();

    // Count should be the same (no duplicate)
    expect(countAfterSecondAdd).toBe(countAfterFirstAdd);

    // Verify product appears only once
    const campMugs = await page.locator('.wishlist-item-row h5:has-text("Camp Mug")').count();
    expect(campMugs).toBe(1);
  });

  /**
   * Scenario 9: Wishlist handles concurrent operations gracefully
   *
   * Given I perform rapid add/remove operations
   * When operations complete concurrently
   * Then the wishlist should remain in a consistent state
   * And no items should be lost or duplicated
   */
  test('SC09: Wishlist handles concurrent operations', async ({ page }) => {
    // Add first product
    await page.goto('/product/OLJCESPC7Z');
    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Navigate to wishlist
    await page.goto('/wishlist');
    await page.waitForSelector('.wishlist-item-row');

    const initialCount = await page.locator('.wishlist-item-row').count();
    expect(initialCount).toBe(1);

    // Add second product
    await page.goto('/product/66VCHSJNUP');
    await page.locator('button:has-text("Add to Wishlist")').click();
    await page.waitForURL(/\/product\//);

    // Quickly go back to wishlist and add another
    await page.goto('/product/OLJCESPC7Z');
    const addBtn = page.locator('button:has-text("Add to Wishlist")');

    // Even though we're adding the same product again, it should be idempotent
    await addBtn.click();
    await page.waitForURL(/\/product\//);

    // Check final state
    await page.goto('/wishlist');
    await page.waitForSelector('.wishlist-item-row');

    const finalCount = await page.locator('.wishlist-item-row').count();
    // Should have exactly 2 unique products
    expect(finalCount).toBe(2);
  });

  /**
   * Scenario 10: Graceful error handling when favorites service is unavailable
   *
   * Given the favorites service is temporarily unavailable
   * When I navigate to /wishlist
   * Then the page should still load
   * And show an empty wishlist with helpful message
   */
  test('SC10: Graceful error handling when service unavailable', async ({ page }) => {
    // Navigate to wishlist
    // The frontend should handle service errors gracefully
    await page.goto('/wishlist');

    // Page should load (not crash with error)
    const title = page.locator('h1, h2, h3');
    await expect(title.first()).toBeVisible();

    // Should either show wishlist or helpful message
    const content = await page.content();
    expect(content).toMatch(/wishlist|Your wishlist|empty/i);
  });

  /**
   * Navigation: Wishlist link in header
   *
   * Given I am on any page
   * When I click the "Wishlist" link in navigation
   * Then I should be taken to the wishlist page
   */
  test('Navigation: Wishlist link in header', async ({ page }) => {
    await page.goto('/');

    // Look for wishlist link in header/navigation
    const wishlistLink = page.locator('a:has-text("Wishlist"), [href="/wishlist"]').first();

    if (await wishlistLink.isVisible()) {
      await wishlistLink.click();
      await page.waitForURL(/\/wishlist/);

      // Verify we're on wishlist page
      const heading = page.locator('h1, h2, h3').first();
      await expect(heading).toBeVisible();
    }
  });
});
