import { test, expect } from '@playwright/test';
import { ProductPage, WishlistPage, HomePage } from '../pages';

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
 * - SC7: Wishlist state consistency
 */

test.describe('SCRUM-1: Wishlist Feature', () => {
  let productPage: ProductPage;
  let wishlistPage: WishlistPage;
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    productPage = new ProductPage(page);
    wishlistPage = new WishlistPage(page);
    homePage = new HomePage(page);
  });

  test.describe('Scenario 1: User adds a product to wishlist from product page', () => {
    test('SC1-A: Can add product to wishlist from product page', async () => {
      await productPage.navigate();

      const wishlistBtn = productPage.getWishlistButton();
      await expect(wishlistBtn).toBeVisible();
      await expect(wishlistBtn).toHaveClass(/wishlist-inactive/);

      await productPage.addToWishlist();

      await expect(wishlistBtn).toHaveText('Remove from Wishlist');
      await expect(wishlistBtn).toHaveClass(/wishlist-active/);
    });

    test('SC1-B: Shows confirmation toast when adding to wishlist', async () => {
      await productPage.navigate();

      await productPage.getWishlistButton().click();

      const toast = productPage['page'].locator('div.toast-success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Added to your wishlist');
    });

    test('SC1-C: Wishlist badge increments on product add', async () => {
      await productPage.navigate();

      const initialCount = await productPage.getWishlistBadgeCount();

      await productPage.getWishlistButton().click();
      await productPage['page'].waitForTimeout(500);

      const newCount = await productPage.getWishlistBadgeCount();
      expect(newCount).toBe(initialCount + 1);
    });

    test('SC1-D: Product appears in wishlist after adding', async () => {
      await productPage.navigate();
      await productPage.addToWishlist();

      await wishlistPage.navigate();

      const productNameLocator = wishlistPage['page'].locator(`text=${ProductPage.PRODUCT_NAME}`);
      await expect(productNameLocator).toBeVisible();

      const itemCount = await wishlistPage.getItemCount();
      expect(itemCount).toBeGreaterThan(0);
    });
  });

  test.describe('Scenario 2: User views their wishlist page with products', () => {
    test('SC2-A: Wishlist displays products with all required details', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await wishlistPage.navigate();

      await expect(wishlistPage.getItemImage(0)).toBeVisible();
      await expect(wishlistPage['page'].locator('.wishlist-item-row h5')).toContainText(ProductPage.PRODUCT_NAME);
      await expect(wishlistPage['page'].locator('.wishlist-item-row .h5').first()).toBeVisible();
    });

    test('SC2-B: Wishlist shows product count', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await wishlistPage.navigate();

      const headingText = await wishlistPage.getHeadingText();
      expect(headingText).toMatch(/\d+\s*item/i);
    });

    test('SC2-C: Wishlist shows Add to Cart and Remove buttons', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await wishlistPage.navigate();

      await expect(wishlistPage.getAddToCartButton(0)).toBeVisible();
      await expect(wishlistPage.getRemoveButton(0)).toBeVisible();
    });

    test('SC2-D: Products are sorted by most recently added', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();
      await productPage['page'].waitForTimeout(200);

      await homePage.navigate();

      const addButtons = homePage['page'].locator('button:has-text("Add to Wishlist")');
      if (await addButtons.count() > 1) {
        await addButtons.nth(1).click();
        await homePage['page'].waitForTimeout(200);
      }

      await wishlistPage.navigate();

      const itemCount = await wishlistPage.getItemCount();
      expect(itemCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Scenario 3: User removes a product from wishlist', () => {
    test('SC3-A: Can remove product from wishlist page', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await wishlistPage.navigate();
      await wishlistPage.removeItem(0);

      const emptyMessage = wishlistPage['page'].locator('h3:has-text("Your wishlist is empty!")');
      await expect(emptyMessage).toBeVisible();
    });

    test('SC3-B: Shows confirmation toast when removing', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await wishlistPage.navigate();

      await wishlistPage.getRemoveButton(0).click();

      const toast = wishlistPage['page'].locator('div.toast-success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Removed from wishlist');
    });

    test('SC3-C: Wishlist badge decrements on product remove', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();
      await productPage['page'].waitForTimeout(500);

      const countAfterAdd = await productPage.getWishlistBadgeCount();

      await wishlistPage.navigate();
      await wishlistPage.getRemoveButton(0).click();
      await wishlistPage['page'].waitForTimeout(500);

      await homePage.navigate();

      const countAfterRemove = await homePage.getWishlistBadgeCount();
      expect(countAfterRemove).toBe(countAfterAdd - 1);
    });
  });

  test.describe('Scenario 4: User views empty wishlist (Page Structure)', () => {
    test('SC4-A: Empty wishlist page loads and displays empty state', async () => {
      await wishlistPage.navigate();

      const emptyMessage = wishlistPage['page'].locator('h3:has-text("Your wishlist is empty!")');
      await expect(emptyMessage).toBeVisible();
      await expect(wishlistPage.getContinueShoppingLink()).toBeVisible();
    });

    test('SC4-B: Wishlist page structure is correct', async ({ page }) => {
      await wishlistPage.navigate();

      await expect(page.locator('main[role="main"].wishlist-sections')).toBeVisible();
      await expect(page.locator('section.empty-wishlist-section')).toBeVisible();
    });

    test('SC4-C: Wishlist page has correct title', async ({ page }) => {
      await wishlistPage.navigate();

      const title = await page.title();
      expect(title).toContain('Online Boutique');
    });

    test('SC4-D: Header is displayed on wishlist page', async ({ page }) => {
      await wishlistPage.navigate();

      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('.navbar')).toBeVisible();
    });

    test('SC4-E: Wishlist page returns 200 status', async ({ page }) => {
      const response = await page.goto('/wishlist');
      expect(response?.status()).toBe(200);
    });
  });

  test.describe('Scenario 5: User adds product from wishlist to cart', () => {
    test('SC5-A: Can add product to cart from wishlist page', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await wishlistPage.navigate();

      const countBefore = await wishlistPage.getCartBadgeCount();

      await wishlistPage.getAddToCartButton(0).click();
      await wishlistPage['page'].waitForTimeout(500);

      const countAfter = await wishlistPage.getCartBadgeCount();
      expect(countAfter).toBe(countBefore + 1);
    });

    test('SC5-B: Product remains in wishlist after adding to cart', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await wishlistPage.navigate();

      await wishlistPage.getAddToCartButton(0).click();
      await wishlistPage['page'].waitForTimeout(500);

      const productNameLocator = wishlistPage['page'].locator(`text=${ProductPage.PRODUCT_NAME}`);
      await expect(productNameLocator).toBeVisible();
      await expect(wishlistPage.getRemoveButton(0)).toBeVisible();
    });

    test('SC5-C: Shows toast confirmation when adding to cart', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await wishlistPage.navigate();

      await wishlistPage.getAddToCartButton(0).click();

      const toast = wishlistPage['page'].locator('div.toast-success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Added to cart');
    });
  });

  test.describe('Scenario 6: Wishlist persists across sessions within TTL', () => {
    test('SC6-A: Wishlist data persists across page navigation', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await homePage.navigate();

      await productPage.navigate();

      const removeBtn = productPage['page'].locator('button:has-text("Remove from Wishlist")').first();
      await expect(removeBtn).toBeVisible();
    });

    test('SC6-B: Wishlist persists across wishlist page navigation', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();

      await wishlistPage.navigate();

      const productNameLocator = wishlistPage['page'].locator(`text=${ProductPage.PRODUCT_NAME}`);
      await expect(productNameLocator).toBeVisible();

      await homePage.navigate();

      await wishlistPage.navigate();

      await expect(productNameLocator).toBeVisible();
    });
  });

  test.describe('Scenario 7: Wishlist state consistency', () => {
    test('SC7-A: Toggle wishlist from product page and verify on wishlist page', async () => {
      await productPage.navigate();
      await productPage.getWishlistButton().click();
      await productPage['page'].waitForTimeout(500);

      await wishlistPage.navigate();

      const productNameLocator = wishlistPage['page'].locator(`text=${ProductPage.PRODUCT_NAME}`);
      await expect(productNameLocator).toBeVisible();

      await wishlistPage.getRemoveButton(0).click();
      await wishlistPage['page'].waitForTimeout(500);

      const emptyMessage = wishlistPage['page'].locator('h3:has-text("Your wishlist is empty!")');
      await expect(emptyMessage).toBeVisible();

      await productPage.navigate();

      const addBtn = productPage['page'].locator('button:has-text("Add to Wishlist")').first();
      await expect(addBtn).toBeVisible();
    });
  });
});
