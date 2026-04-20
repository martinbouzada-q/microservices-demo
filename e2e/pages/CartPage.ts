import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Cart page (/cart).
 */
export class CartPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await super.navigate('/cart');
  }

  getCartItems(): Locator {
    return this.page.locator('.cart-item, [class*="cart-item"]');
  }

  async getCartItemCount(): Promise<number> {
    return this.page.locator('.cart-item, [class*="cart-item"]').count();
  }

  getEmptyCartMessage(): Locator {
    return this.page.locator('text=Your shopping cart is empty');
  }
}
