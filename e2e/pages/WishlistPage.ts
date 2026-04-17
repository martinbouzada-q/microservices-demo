import { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the wishlist page (/wishlist).
 * Encapsulates all interactions with the wishlist view, including
 * item listing, removal, and add-to-cart actions.
 */
export class WishlistPage extends BasePage {
  /**
   * Navigates to the wishlist page.
   */
  async navigate(): Promise<void> {
    await super.navigate('/wishlist');
  }

  /**
   * Returns true when the empty-wishlist state heading is visible.
   */
  async isEmpty(): Promise<boolean> {
    return this.page.locator('h3:has-text("Your wishlist is empty!")').isVisible();
  }

  /**
   * Returns the number of product rows currently shown in the wishlist.
   */
  async getItemCount(): Promise<number> {
    return this.page.locator('.wishlist-item-row').count();
  }

  /**
   * Returns a locator scoped to the wishlist item at the given zero-based index.
   */
  getItemLocator(index: number): Locator {
    return this.page.locator('.wishlist-item-row').nth(index);
  }

  /**
   * Reads the product name from the wishlist item at the given index.
   */
  async getItemName(index: number): Promise<string> {
    return (await this.getItemLocator(index).locator('h5').textContent()) ?? '';
  }

  /**
   * Reads the formatted price from the wishlist item at the given index.
   */
  async getItemPrice(index: number): Promise<string> {
    return (await this.getItemLocator(index).locator('.h5').textContent()) ?? '';
  }

  /**
   * Returns a locator for the product image inside the wishlist item at the given index.
   */
  getItemImage(index: number): Locator {
    return this.getItemLocator(index).locator('img');
  }

  /**
   * Returns a locator for the "Remove from Wishlist" button at the given index.
   */
  getRemoveButton(index: number): Locator {
    return this.page.locator('button:has-text("Remove from Wishlist")').nth(index);
  }

  /**
   * Returns a locator for the "Add to Cart" button at the given index.
   */
  getAddToCartButton(index: number): Locator {
    return this.page.locator('button:has-text("Add to Cart")').nth(index);
  }

  /**
   * Clicks the remove button for the item at the given index and waits for the response.
   */
  async removeItem(index: number): Promise<void> {
    await this.getRemoveButton(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clicks the add-to-cart button for the item at the given index and waits for the response.
   */
  async addItemToCart(index: number): Promise<void> {
    await this.getAddToCartButton(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Returns a locator for the "Continue Shopping" link shown on the empty wishlist state.
   */
  getContinueShoppingLink(): Locator {
    return this.page.locator('a:has-text("Continue Shopping")');
  }

  /**
   * Reads the text of the main h3 heading on the wishlist page.
   */
  async getHeadingText(): Promise<string> {
    return (await this.page.locator('h3').textContent()) ?? '';
  }
}
