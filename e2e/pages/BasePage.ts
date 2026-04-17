import { Page } from '@playwright/test';

/**
 * Base page object providing shared navigation and UI interaction utilities
 * used across all page objects in the Online Boutique test suite.
 */
export class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Reads the wishlist badge count from the navbar.
   * Returns 0 when the badge element is absent or contains no numeric text.
   */
  async getWishlistBadgeCount(): Promise<number> {
    const badge = this.page.locator('#wishlist-count');
    const text = await badge.textContent().catch(() => null);
    return parseInt(text ?? '0') || 0;
  }

  /**
   * Reads the cart badge count from the navbar.
   * Returns 0 when the badge element is absent or contains no numeric text.
   */
  async getCartBadgeCount(): Promise<number> {
    const badge = this.page.locator('#cart-count');
    const text = await badge.textContent().catch(() => null);
    return parseInt(text ?? '0') || 0;
  }

  /**
   * Waits for a success toast to appear and returns its text content.
   */
  async getToastSuccessMessage(): Promise<string> {
    const toast = this.page.locator('div.toast-success');
    await toast.waitFor({ state: 'visible' });
    return (await toast.textContent()) ?? '';
  }

  /**
   * Waits for a success toast to become visible and then disappear.
   */
  async waitForToast(): Promise<void> {
    const toast = this.page.locator('div.toast-success');
    await toast.waitFor({ state: 'visible' });
    await toast.waitFor({ state: 'hidden' });
  }

  /**
   * Navigates to the given path and waits for network activity to settle.
   */
  async navigate(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }
}
