import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { urls } from '../config/urls';

export class OrderDetailPage extends BasePage {
  private readonly title: Locator;
  private readonly statusTimeline: Locator;
  private readonly statusItems: Locator;
  private readonly itemsTable: Locator;
  private readonly summary: Locator;
  private readonly addressBlock: Locator;
  private readonly backLink: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.locator('h1');
    this.statusTimeline = page.locator('.order-status-timeline');
    this.statusItems = page.locator('.status-item');
    this.itemsTable = page.locator('table');
    this.summary = page.locator('.order-summary');
    this.addressBlock = page.locator('.address-block');
    this.backLink = page.getByRole('link', { name: 'Back to Orders' });
  }

  async goto(orderId: string): Promise<void> {
    await this.page.goto(urls.order(orderId));
  }

  get heading(): Locator {
    return this.title;
  }
  get timeline(): Locator {
    return this.statusTimeline;
  }
  get steps(): Locator {
    return this.statusItems;
  }
  get table(): Locator {
    return this.itemsTable;
  }
  get summaryBlock(): Locator {
    return this.summary;
  }
  get shippingAddress(): Locator {
    return this.addressBlock;
  }
  get backToOrders(): Locator {
    return this.backLink;
  }
}
