import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { urls } from '../config/urls';

export class HomePage extends BasePage {
  private readonly productCards: Locator;
  private readonly addToWishlistButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.productCards = page.locator('.product-list-item');
    this.addToWishlistButtons = page.getByRole('button', { name: 'Add to Wishlist' });
  }

  async goto(): Promise<void> {
    await this.page.goto(urls.home);
  }

  get productGrid(): Locator {
    return this.productCards;
  }

  async openFirstProduct(): Promise<void> {
    await this.productCards.first().click();
  }

  async addNthCardToWishlist(index: number): Promise<void> {
    await this.addToWishlistButtons.nth(index).click();
  }

  async addToWishlistButtonCount(): Promise<number> {
    return this.addToWishlistButtons.count();
  }
}
