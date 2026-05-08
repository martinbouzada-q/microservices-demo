import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { urls } from '../config/urls';

export class WishlistPage extends BasePage {
  private readonly itemRows: Locator;
  private readonly emptyHeading: Locator;
  private readonly heading: Locator;
  private readonly continueShopping: Locator;
  private readonly removeButtons: Locator;
  private readonly addToCartButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.itemRows = page.locator('.wishlist-item-row');
    this.emptyHeading = page.locator('h3:has-text("Your wishlist is empty!")');
    this.heading = page.locator('h3').first();
    this.continueShopping = page.getByRole('link', { name: 'Continue Shopping' });
    this.removeButtons = page.getByRole('button', { name: 'Remove from Wishlist' });
    this.addToCartButtons = page.getByRole('button', { name: 'Add to Cart' });
  }

  async goto(): Promise<void> {
    await this.page.goto(urls.wishlist);
  }

  get items(): Locator {
    return this.itemRows;
  }

  get emptyState(): Locator {
    return this.emptyHeading;
  }

  get headingText(): Locator {
    return this.heading;
  }

  get continueShoppingLink(): Locator {
    return this.continueShopping;
  }

  itemAt(index: number): Locator {
    return this.itemRows.nth(index);
  }

  itemName(index: number): Locator {
    return this.itemAt(index).locator('h5');
  }

  itemPrice(index: number): Locator {
    return this.itemAt(index).locator('.h5');
  }

  itemImage(index: number): Locator {
    return this.itemAt(index).locator('img');
  }

  async itemCount(): Promise<number> {
    return this.itemRows.count();
  }

  async removeItem(index: number): Promise<void> {
    await this.removeButtons.nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  async addItemToCart(index: number): Promise<void> {
    await this.addToCartButtons.nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }
}
