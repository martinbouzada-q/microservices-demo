import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { urls } from '../config/urls';

export class CartPage extends BasePage {
  private readonly items: Locator;
  private readonly emptyMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.items = page.locator('.cart-item, [class*="cart-item"]');
    this.emptyMessage = page.getByText('Your shopping cart is empty');
  }

  async goto(): Promise<void> {
    await this.page.goto(urls.cart);
  }

  get itemRows(): Locator {
    return this.items;
  }

  get emptyState(): Locator {
    return this.emptyMessage;
  }

  async itemCount(): Promise<number> {
    return this.items.count();
  }
}
