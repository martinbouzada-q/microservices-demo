import { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the product detail page (/product/:id).
 * Encapsulates all interactions with the product view, including
 * wishlist toggle and add-to-cart (AJAX) actions.
 */
export class ProductPage extends BasePage {
  static readonly PRODUCT_ID = 'OLJCESPC7Z';
  static readonly PRODUCT_NAME = 'Sunglasses';

  async navigate(productId: string = ProductPage.PRODUCT_ID): Promise<void> {
    await super.navigate(`/product/${productId}`);
  }

  async getProductName(): Promise<string> {
    const heading = this.page.locator('h2.product-name, h1').first();
    return (await heading.textContent()) ?? '';
  }

  // ── Wishlist ──────────────────────────────────────────────────────────────

  getWishlistButton(): Locator {
    return this.page
      .locator('button:has-text("Add to Wishlist"), button:has-text("Remove from Wishlist")')
      .first();
  }

  async isInWishlist(): Promise<boolean> {
    const classes = await this.getWishlistButton().getAttribute('class');
    return classes?.includes('wishlist-active') ?? false;
  }

  async addToWishlist(): Promise<void> {
    await this.getWishlistButton().click();
    await this.page.waitForLoadState('networkidle');
  }

  async removeFromWishlist(): Promise<void> {
    await this.getWishlistButton().click();
    await this.page.waitForLoadState('networkidle');
  }

  // ── Add To Cart ───────────────────────────────────────────────────────────

  /** The primary Add To Cart submit button. */
  getAddToCartButton(): Locator {
    return this.page.locator('button.add-to-cart-btn').first();
  }

  /** The quantity dropdown selector. */
  getQuantitySelect(): Locator {
    return this.page.locator('select[name="quantity"]');
  }

  /** Set the quantity dropdown to the given value. */
  async selectQuantity(quantity: number): Promise<void> {
    await this.getQuantitySelect().selectOption(String(quantity));
  }

  /**
   * Click Add To Cart and wait for network to settle.
   * With SCRUM-5 AJAX: stays on product page, shows toast.
   * Without AJAX (fallback): redirects to /cart.
   */
  async clickAddToCart(): Promise<void> {
    await this.getAddToCartButton().click();
    await this.page.waitForLoadState('networkidle');
  }

  /** True while the button is disabled (loading state). */
  async isAddToCartLoading(): Promise<boolean> {
    return this.getAddToCartButton().isDisabled();
  }

  /** True if still on the product page (AJAX succeeded, no redirect). */
  isOnProductPage(): boolean {
    return this.page.url().includes('/product/');
  }

  /** The spinner element inside the Add To Cart button. */
  getButtonSpinner(): Locator {
    return this.getAddToCartButton().locator('.btn-spinner');
  }
}
