import { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the product detail page (/product/:id).
 * Encapsulates all interactions with the product view, including
 * the wishlist toggle button and product metadata.
 */
export class ProductPage extends BasePage {
  static readonly PRODUCT_ID = 'OLJCESPC7Z';
  static readonly PRODUCT_NAME = 'Sunglasses';

  /**
   * Navigates to the product detail page.
   * Defaults to the canonical Sunglasses product when no ID is provided.
   */
  async navigate(productId: string = ProductPage.PRODUCT_ID): Promise<void> {
    await super.navigate(`/product/${productId}`);
  }

  /**
   * Reads the product name from the heading element on the page.
   */
  async getProductName(): Promise<string> {
    const heading = this.page.locator('h2.product-name, h1').first();
    return (await heading.textContent()) ?? '';
  }

  /**
   * Returns the first visible wishlist toggle button, regardless of its current state.
   */
  getWishlistButton(): Locator {
    return this.page
      .locator('button:has-text("Add to Wishlist"), button:has-text("Remove from Wishlist")')
      .first();
  }

  /**
   * Returns true when the wishlist button reflects an active (added) state.
   */
  async isInWishlist(): Promise<boolean> {
    const classes = await this.getWishlistButton().getAttribute('class');
    return classes?.includes('wishlist-active') ?? false;
  }

  /**
   * Clicks the wishlist button to add the product and waits for the request to complete.
   */
  async addToWishlist(): Promise<void> {
    await this.getWishlistButton().click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clicks the wishlist button to remove the product and waits for the request to complete.
   */
  async removeFromWishlist(): Promise<void> {
    await this.getWishlistButton().click();
    await this.page.waitForLoadState('networkidle');
  }
}
