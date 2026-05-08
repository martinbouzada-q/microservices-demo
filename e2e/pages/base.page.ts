import type { Locator, Page } from '@playwright/test';

/**
 * Shared utilities for all page objects.
 * Subclasses MUST keep all element-specific locators private — only expose
 * business actions and assertable getters.
 */
export class BasePage {
  protected readonly page: Page;
  private readonly cartBadge: Locator;
  private readonly wishlistBadge: Locator;
  private readonly toastSuccess: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartBadge = page.locator('#cart-count');
    this.wishlistBadge = page.locator('#wishlist-count');
    this.toastSuccess = page.locator('div.toast-success');
  }

  get successToast(): Locator {
    return this.toastSuccess;
  }

  async cartBadgeCount(): Promise<number> {
    const text = await this.cartBadge.textContent().catch(() => null);
    return Number.parseInt(text ?? '0', 10) || 0;
  }

  async wishlistBadgeCount(): Promise<number> {
    const text = await this.wishlistBadge.textContent().catch(() => null);
    return Number.parseInt(text ?? '0', 10) || 0;
  }

  async waitForToastToDismiss(): Promise<void> {
    await this.toastSuccess.waitFor({ state: 'visible' });
    await this.toastSuccess.waitFor({ state: 'hidden' });
  }
}
