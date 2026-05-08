import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { urls } from '../config/urls';

export class ProductPage extends BasePage {
  private readonly heading: Locator;
  private readonly wishlistToggle: Locator;
  private readonly addToCartBtn: Locator;
  private readonly quantitySelect: Locator;
  private readonly spinner: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h2.product-name, h1').first();
    this.wishlistToggle = page
      .locator('button:has-text("Add to Wishlist"), button:has-text("Remove from Wishlist")')
      .first();
    this.addToCartBtn = page.locator('button.add-to-cart-btn').first();
    this.quantitySelect = page.locator('select[name="quantity"]');
    this.spinner = this.addToCartBtn.locator('.btn-spinner');
  }

  async goto(productId: string): Promise<void> {
    await this.page.goto(urls.product(productId));
  }

  get name(): Locator {
    return this.heading;
  }

  get wishlistButton(): Locator {
    return this.wishlistToggle;
  }

  get addToCartButton(): Locator {
    return this.addToCartBtn;
  }

  get buttonSpinner(): Locator {
    return this.spinner;
  }

  async toggleWishlist(): Promise<void> {
    await this.wishlistToggle.click();
  }

  async selectQuantity(quantity: number): Promise<void> {
    await this.quantitySelect.selectOption(String(quantity));
  }

  async addToCart(): Promise<void> {
    await this.addToCartBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  isOnProductPage(): boolean {
    return this.page.url().includes('/product/');
  }
}
