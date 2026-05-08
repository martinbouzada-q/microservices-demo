import { test, expect } from '../fixtures';
import { api } from '../api';
import { testProducts } from '../fixtures/data';
import { HomePage, ProductPage, WishlistPage } from '../pages';

const product = testProducts.sunglasses;

test.describe('Wishlist Feature', () => {
  test.describe('Adding from product page', () => {
    test('adds product, swaps button label, and shows toast', async ({ freshSession: page }) => {
      const productPage = new ProductPage(page);
      await productPage.goto(product.id);

      await expect(productPage.wishlistButton).toBeVisible();
      await expect(productPage.wishlistButton).toHaveClass(/wishlist-inactive/);

      await productPage.toggleWishlist();

      await expect(productPage.wishlistButton).toHaveText('Remove from Wishlist');
      await expect(productPage.wishlistButton).toHaveClass(/wishlist-active/);
      await expect(productPage.successToast).toContainText('Added to your wishlist');
    });

    test('badge increments by one', async ({ freshSession: page }) => {
      const productPage = new ProductPage(page);
      await productPage.goto(product.id);
      const before = await productPage.wishlistBadgeCount();
      await productPage.toggleWishlist();
      await expect.poll(() => productPage.wishlistBadgeCount()).toBe(before + 1);
    });

    test('product appears on wishlist page', async ({ freshSession: page, request }) => {
      await api.wishlist.add(request, product.id);
      const wishlistPage = new WishlistPage(page);
      await wishlistPage.goto();

      await expect(wishlistPage.itemName(0)).toContainText(product.name);
      await expect.poll(() => wishlistPage.itemCount()).toBeGreaterThan(0);
    });
  });

  test.describe('Viewing the wishlist', () => {
    test.beforeEach(async ({ freshSession: _page, request }) => {
      const res = await api.wishlist.add(request, product.id);
      expect(res.ok() || res.status() === 303).toBeTruthy();
    });

    test('displays image, name, and price', async ({ page }) => {
      const wishlistPage = new WishlistPage(page);
      await wishlistPage.goto();

      await expect(wishlistPage.itemImage(0)).toBeVisible();
      await expect(wishlistPage.itemName(0)).toContainText(product.name);
      await expect(wishlistPage.itemPrice(0)).toBeVisible();
    });

    test('shows item count in heading', async ({ page }) => {
      const wishlistPage = new WishlistPage(page);
      await wishlistPage.goto();
      await expect(wishlistPage.headingText).toContainText(/\d+\s*item/i);
    });
  });

  test.describe('Removing from the wishlist', () => {
    test('removes the item and shows empty state', async ({ freshSession: page, request }) => {
      await api.wishlist.add(request, product.id);
      const wishlistPage = new WishlistPage(page);
      await wishlistPage.goto();
      await wishlistPage.removeItem(0);
      await expect(wishlistPage.emptyState).toBeVisible();
    });

    test('shows removal toast', async ({ freshSession: page, request }) => {
      await api.wishlist.add(request, product.id);
      const wishlistPage = new WishlistPage(page);
      await wishlistPage.goto();
      await wishlistPage.removeItem(0);
      await expect(wishlistPage.successToast).toContainText('Removed from wishlist');
    });

    test('badge decrements after remove', async ({ freshSession: page, request }) => {
      await api.wishlist.add(request, product.id);
      const wishlistPage = new WishlistPage(page);
      await wishlistPage.goto();
      const before = await wishlistPage.wishlistBadgeCount();
      await wishlistPage.removeItem(0);
      await expect.poll(() => wishlistPage.wishlistBadgeCount()).toBe(before - 1);
    });
  });

  test.describe('Empty wishlist state', () => {
    test('shows empty heading and continue-shopping link', async ({ freshSession: page }) => {
      const wishlistPage = new WishlistPage(page);
      await wishlistPage.goto();
      await expect(wishlistPage.emptyState).toBeVisible();
      await expect(wishlistPage.continueShoppingLink).toBeVisible();
    });

    test('responds with 200', async ({ freshSession: page }) => {
      const wishlistPage = new WishlistPage(page);
      const response = await page.goto('/wishlist');
      expect(response?.status()).toBe(200);
      await expect(wishlistPage.emptyState).toBeVisible();
    });
  });

  test.describe('Adding wishlist item to cart', () => {
    test('cart badge increments and item stays in wishlist', async ({ freshSession: page, request }) => {
      await api.wishlist.add(request, product.id);
      const wishlistPage = new WishlistPage(page);
      await wishlistPage.goto();

      const cartBefore = await wishlistPage.cartBadgeCount();
      await wishlistPage.addItemToCart(0);

      await expect.poll(() => wishlistPage.cartBadgeCount()).toBe(cartBefore + 1);
      await expect(wishlistPage.itemName(0)).toContainText(product.name);
    });
  });

  test.describe('Persistence within session', () => {
    test('survives navigation back to product page', async ({ freshSession: page, request }) => {
      await api.wishlist.add(request, product.id);
      const productPage = new ProductPage(page);
      await productPage.goto(product.id);
      await expect(productPage.wishlistButton).toHaveText('Remove from Wishlist');
    });

    test('survives navigation away and back to wishlist', async ({ freshSession: page, request }) => {
      await api.wishlist.add(request, product.id);
      const wishlistPage = new WishlistPage(page);
      const homePage = new HomePage(page);

      await wishlistPage.goto();
      await expect(wishlistPage.itemName(0)).toContainText(product.name);
      await homePage.goto();
      await wishlistPage.goto();
      await expect(wishlistPage.itemName(0)).toContainText(product.name);
    });
  });
});
