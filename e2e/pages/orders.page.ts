import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { urls } from '../config/urls';

export class OrdersPage extends BasePage {
  private readonly title: Locator;
  private readonly orderCards: Locator;
  private readonly orderLinks: Locator;
  private readonly statusBadges: Locator;
  private readonly emptyMessage: Locator;
  private readonly startShoppingBtn: Locator;
  private readonly pagination: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.locator('h1');
    this.orderCards = page.locator('.order-card');
    this.orderLinks = page.locator('.order-link');
    this.statusBadges = page.locator('.badge');
    this.emptyMessage = page.getByText("You haven't placed any orders yet");
    this.startShoppingBtn = page.getByRole('link', { name: 'Start Shopping' });
    this.pagination = page.locator('nav[aria-label="Page navigation"]');
  }

  async goto(): Promise<void> {
    await this.page.goto(urls.orders);
  }

  async gotoPage(pageNumber: number): Promise<void> {
    await this.page.goto(`${urls.orders}?page=${pageNumber}`);
  }

  get pageTitle(): Locator {
    return this.title;
  }
  get cards(): Locator {
    return this.orderCards;
  }
  get links(): Locator {
    return this.orderLinks;
  }
  get badges(): Locator {
    return this.statusBadges;
  }
  get emptyState(): Locator {
    return this.emptyMessage;
  }
  get startShoppingButton(): Locator {
    return this.startShoppingBtn;
  }
  get paginationNav(): Locator {
    return this.pagination;
  }

  async openFirstOrder(): Promise<string> {
    const link = this.orderLinks.first();
    const id = (await link.textContent())?.trim() ?? '';
    await link.click();
    return id;
  }
}
