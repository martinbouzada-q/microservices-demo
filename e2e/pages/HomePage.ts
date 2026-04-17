import { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the home page (/).
 * Encapsulates interaction with the product listing grid.
 */
export class HomePage extends BasePage {
  /**
   * Navigates to the home page.
   */
  async navigate(): Promise<void> {
    await super.navigate('/');
  }

  /**
   * Returns a locator matching all product card elements in the listing grid.
   */
  getProductCards(): Locator {
    return this.page.locator('.product-list-item');
  }

  /**
   * Clicks the first product card in the listing grid.
   */
  async clickFirstProduct(): Promise<void> {
    await this.getProductCards().first().click();
    await this.page.waitForLoadState('networkidle');
  }
}
