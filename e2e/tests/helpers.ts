import { Page, expect } from '@playwright/test';

/**
 * Helper functions for E2E tests
 */

/**
 * Navigate to a product page and verify it loads
 */
export async function navigateToProduct(page: Page, productId: string) {
  await page.goto(`/product/${productId}`);
  await page.waitForSelector('h1');
}

/**
 * Add a product to the wishlist and verify redirect
 */
export async function addProductToWishlist(page: Page) {
  const addBtn = page.locator('button:has-text("Add to Wishlist")');
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await page.waitForURL(/\/product\//);
}

/**
 * Navigate to wishlist and wait for it to load
 */
export async function openWishlist(page: Page) {
  await page.goto('/wishlist');
  // Either items load or empty state appears
  const items = page.locator('.wishlist-item-row');
  const emptyState = page.locator('h3:has-text("Your wishlist is empty")');
  await expect(items.or(emptyState)).toBeVisible();
}

/**
 * Get the count of items in the wishlist
 */
export async function getWishlistItemCount(page: Page): Promise<number> {
  return await page.locator('.wishlist-item-row').count();
}

/**
 * Get the current currency from page
 */
export async function getCurrentCurrency(page: Page): Promise<string> {
  const currencyEl = page.locator('[class*="currency"]').first();
  if (await currencyEl.isVisible()) {
    return (await currencyEl.textContent()) || 'USD';
  }
  return 'USD';
}

/**
 * Clear the entire wishlist by removing all items
 */
export async function clearWishlist(page: Page) {
  await openWishlist(page);

  let count = await getWishlistItemCount(page);
  while (count > 0) {
    const removeBtn = page.locator('button:has-text("Remove from Wishlist")').first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await page.waitForURL(/\/wishlist/);
    }
    count = await getWishlistItemCount(page);
  }
}

/**
 * Verify wishlist item contains expected product details
 */
export async function verifyWishlistItem(
  page: Page,
  index: number,
  expectedProductName: string,
) {
  const item = page.locator('.wishlist-item-row').nth(index);
  const nameEl = item.locator('h5');
  const priceEl = item.locator('.h5');
  const dateEl = item.locator('.text-muted.small');

  await expect(nameEl).toContainText(expectedProductName);
  await expect(priceEl).toBeVisible(); // Should have price
  await expect(dateEl).toContainText('Added'); // Should have date
}

/**
 * Wait for network requests to complete
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}
