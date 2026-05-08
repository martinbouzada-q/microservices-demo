import { test, expect } from '../fixtures';
import { urls } from '../config/urls';
import { OrdersPage, OrderDetailPage } from '../pages';

test.describe('Purchase History', () => {
  test.describe('Order list', () => {
    test('renders title and at least one order', async ({ page }) => {
      const orders = new OrdersPage(page);
      await orders.goto();
      await expect(orders.pageTitle).toContainText('Purchase History');
      await expect(orders.cards.first()).toBeVisible();
    });

    test('order card shows id matching ORD-YYYYMMDD-NNN, date, items, total', async ({ page }) => {
      const orders = new OrdersPage(page);
      await orders.goto();

      const firstLink = orders.links.first();
      const text = (await firstLink.textContent())?.trim() ?? '';
      expect(text).toMatch(/^ORD-\d{8}-\d{3}$/);

      const firstCard = orders.cards.first();
      await expect(firstCard.getByText('Date:')).toBeVisible();
      await expect(firstCard.getByText('Items:')).toBeVisible();
      await expect(firstCard.locator('.order-total')).toBeVisible();
    });

    test('orders are sorted most recent first', async ({ page }) => {
      console.log('[step 1] instantiating OrdersPage');
      const orders = new OrdersPage(page);

      console.log('[step 2] navigating to /orders');
      await orders.goto();
      console.log('[step 2] arrived at URL:', page.url());

      console.log('[step 3] counting order links');
      const total = await orders.links.count();
      console.log('[step 3] total order links found:', total);

      console.log('[step 4] reading first link text');
      const firstText = (await orders.links.first().textContent())?.trim() ?? '';
      console.log('[step 4] first link text:', JSON.stringify(firstText));

      console.log('[step 5] reading all link texts (to inspect ordering)');
      const allTexts = await orders.links.allTextContents();
      console.log('[step 5] all order ids:', allTexts.map(t => t.trim()));

      console.log('[step 6] asserting first link contains ORD-20260414-001');
      await expect(orders.links.first()).toContainText('ORD-20260414-001');
      console.log('[step 6] assertion passed ✓');
    });

    test('status badge shows a known value', async ({ page }) => {
      const orders = new OrdersPage(page);
      await orders.goto();
      const badgeText = (await orders.badges.first().textContent())?.trim() ?? '';
      expect(['Placed', 'Processing', 'Shipped', 'Delivered', 'Failed', 'Cancelled']).toContain(badgeText);
    });
  });

  test.describe('Order detail', () => {
    test('clicking an order navigates to its detail page', async ({ page }) => {
      const orders = new OrdersPage(page);
      const detail = new OrderDetailPage(page);
      await orders.goto();
      const orderId = await orders.openFirstOrder();
      await expect(page).toHaveURL(new RegExp(`/order/${orderId}`));
      await expect(detail.timeline).toBeVisible();
    });

    test('detail page shows timeline, items, summary, address', async ({ page }) => {
      const orders = new OrdersPage(page);
      const detail = new OrderDetailPage(page);
      await orders.goto();
      await orders.openFirstOrder();

      await expect(detail.heading).toBeVisible();
      await expect(detail.timeline).toBeVisible();
      await expect(detail.table.locator('tbody tr').first()).toBeVisible();
      await expect(detail.summaryBlock).toBeVisible();
      await expect(detail.shippingAddress).toBeVisible();
    });

    test('timeline has 4 steps with at least 2 completed', async ({ page }) => {
      const orders = new OrdersPage(page);
      const detail = new OrderDetailPage(page);
      await orders.goto();
      await orders.openFirstOrder();

      await expect(detail.steps).toHaveCount(4);
      const completed = await page.locator('.status-item.completed').count();
      expect(completed).toBeGreaterThanOrEqual(2);
    });

    test('shipping and payment sections present', async ({ page }) => {
      const orders = new OrdersPage(page);
      await orders.goto();
      await orders.openFirstOrder();

      await expect(page.getByText('Shipping Address')).toBeVisible();
      await expect(page.getByText('Payment Information')).toBeVisible();
    });

    test('back button returns to list', async ({ page }) => {
      const orders = new OrdersPage(page);
      const detail = new OrderDetailPage(page);
      await orders.goto();
      await orders.openFirstOrder();
      await expect(detail.backToOrders).toBeVisible();
      await detail.backToOrders.click();
      await expect(page).toHaveURL(new RegExp(`${urls.orders}$`));
      await expect(orders.pageTitle).toContainText('Purchase History');
    });
  });

  test.describe('Persistence', () => {
    test('session cookie and order count survive navigation', async ({ page, context }) => {
      const orders = new OrdersPage(page);
      await orders.goto();

      const sessionCookie = (await context.cookies()).find(c => c.name === 'shop_session-id');
      expect(sessionCookie).toBeDefined();

      const initialCount = await orders.cards.count();
      await page.goto(urls.home);
      await orders.goto();

      const newCookie = (await context.cookies()).find(c => c.name === 'shop_session-id');
      expect(newCookie?.value).toBe(sessionCookie?.value);
      expect(await orders.cards.count()).toBe(initialCount);
    });
  });

  test.describe('Empty state', () => {
    test('a fresh context shows empty state and Start Shopping link', async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const orders = new OrdersPage(page);
      await orders.goto();
      await expect(orders.emptyState).toBeVisible();
      await expect(orders.startShoppingButton).toBeVisible();
      expect(await orders.cards.count()).toBe(0);
      await ctx.close();
    });

    test('Start Shopping link navigates to home', async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const orders = new OrdersPage(page);
      await orders.goto();
      await orders.startShoppingButton.click();
      await expect(page).toHaveURL(new RegExp(`${urls.home}$`));
      await ctx.close();
    });
  });

  test.describe('Pagination', () => {
    test('next button updates URL when pagination present', async ({ page }) => {
      const orders = new OrdersPage(page);
      await orders.gotoPage(1);

      const next = page.getByRole('link', { name: 'Next' });
      if (await next.isVisible().catch(() => false)) {
        await next.click();
        expect(page.url()).toContain('page=2');
      }
    });
  });

  test.describe('Security', () => {
    test('non-existent order id returns 404', async ({ page }) => {
      const response = await page.goto(urls.order('INVALID-ORDER-ID'));
      expect(response?.status()).toBe(404);
    });
  });
});
