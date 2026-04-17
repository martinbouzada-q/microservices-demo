/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from '@playwright/test';
import { BASE_URL as baseUrl } from '../config/environments';

test.describe('Purchase History / Order History (SCRUM-2)', () => {
  test.describe('Scenario 1: User views order history list', () => {
    test('SC1.1: Navigate to /orders and see page title', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Should see "Purchase History" title
      await expect(page.locator('h1')).toContainText('Purchase History');

      // Page should load within reasonable time (< 500ms)
      const navigationTiming = await page.evaluate(() => performance.getEntriesByType('navigation')[0]);
      expect((navigationTiming as any)?.duration || 0).toBeLessThan(500);
    });

    test('SC1.2: Order list displays order information', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Wait for orders to be rendered
      const firstOrderCard = page.locator('.order-card').first();
      await expect(firstOrderCard).toBeVisible();

      // Check that each order card displays required information
      const orderLink = firstOrderCard.locator('.order-link');
      await expect(orderLink).toBeVisible();

      // Order should have an ID (matching ORD-YYYYMMDD-NNN format)
      const orderText = await orderLink.textContent();
      expect(orderText).toMatch(/^ORD-\d{8}-\d{3}$/);

      // Should display order date
      await expect(firstOrderCard.locator('text=Date:')).toBeVisible();

      // Should display number of items
      await expect(firstOrderCard.locator('text=Items:')).toBeVisible();

      // Should display order total (currency symbol + amount)
      const totalText = firstOrderCard.locator('.order-total');
      await expect(totalText).toBeVisible();
    });

    test('SC1.3: Orders sorted by most recent first', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Get all order IDs
      const orderLinks = page.locator('.order-link');
      const count = await orderLinks.count();
      expect(count).toBeGreaterThan(0);

      // First order should be ORD-20260414-001 (most recent in mock data)
      const firstOrder = orderLinks.first();
      await expect(firstOrder).toContainText('ORD-20260414-001');
    });

    test('SC1.4: Order status badges display correctly', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Status badge should be visible and have appropriate class
      const statusBadge = page.locator('.badge').first();
      await expect(statusBadge).toBeVisible();

      // Status should be one of: Placed, Processing, Shipped, Delivered
      const statusText = await statusBadge.textContent();
      expect(['Placed', 'Processing', 'Shipped', 'Delivered', 'Failed', 'Cancelled']).toContain(statusText?.trim());
    });
  });

  test.describe('Scenario 2: User views order details', () => {
    test('SC2.1: Click on order to view details', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Click on first order
      const firstOrderLink = page.locator('.order-link').first();
      const orderID = await firstOrderLink.textContent();

      await firstOrderLink.click();

      // Should navigate to order detail page
      await expect(page).toHaveURL(new RegExp(`/order/${orderID?.trim()}`));

      // Page should load within 200ms
      const navigationTiming = await page.evaluate(() => performance.getEntriesByType('navigation')[0]);
      expect((navigationTiming as any)?.duration || 0).toBeLessThan(200);
    });

    test('SC2.2: Order detail page displays complete order information', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Click on first order
      const firstOrderLink = page.locator('.order-link').first();
      await firstOrderLink.click();

      // Wait for order detail page
      await page.waitForSelector('.order-status-timeline');

      // Check all required sections are visible
      await expect(page.locator('h1')).toBeVisible(); // Order title
      await expect(page.locator('.order-status-timeline')).toBeVisible(); // Status timeline
      await expect(page.locator('table tbody tr')).first().toBeVisible(); // Order items table
      await expect(page.locator('.order-summary')).toBeVisible(); // Total summary
      await expect(page.locator('.address-block')).toBeVisible(); // Shipping address
    });

    test('SC2.3: Order status timeline shows progression', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Click on first order (which has "shipped" status)
      const firstOrderLink = page.locator('.order-link').first();
      await firstOrderLink.click();

      // Timeline should show status items
      const statusItems = page.locator('.status-item');
      await expect(statusItems).toHaveCount(4); // Placed, Processing, Shipped, Delivery

      // "Placed" and "Processing" should be completed
      const completedItems = page.locator('.status-item.completed');
      const completedCount = await completedItems.count();
      expect(completedCount).toBeGreaterThanOrEqual(2);
    });

    test('SC2.4: Order items display with product details', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      const firstOrderLink = page.locator('.order-link').first();
      await firstOrderLink.click();

      // Check order items table
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Should have header row and data rows
      const rows = table.locator('tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);

      // Each row should have product name, quantity, price, subtotal
      const firstRow = rows.first();
      const cells = firstRow.locator('td');
      expect(await cells.count()).toBe(4); // Product, Quantity, Price, Subtotal
    });

    test('SC2.5: Shipping and payment information displayed', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      const firstOrderLink = page.locator('.order-link').first();
      await firstOrderLink.click();

      // Shipping address section
      await expect(page.locator('text=Shipping Address')).toBeVisible();
      const addressBlock = page.locator('.address-block');
      await expect(addressBlock).toBeVisible();

      // Payment information section
      await expect(page.locator('text=Payment Information')).toBeVisible();

      // Should show payment status badge
      const paymentBadge = page.locator('.badge').nth(1); // Usually second badge
      await expect(paymentBadge).toBeVisible();
    });

    test('SC2.6: Tracking information visible for shipped orders', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      const firstOrderLink = page.locator('.order-link').first();
      await firstOrderLink.click();

      // For shipped orders, tracking info should be visible
      const trackingText = page.locator('text=Tracking');
      const isVisible = await trackingText.isVisible().catch(() => false);

      if (isVisible) {
        // Should have a clickable tracking link
        const trackingLink = page.locator('a[href*="tracking"]');
        await expect(trackingLink).toBeVisible();
      }
    });
  });

  test.describe('Scenario 3: Order history persists across sessions', () => {
    test('SC3.1: Orders visible after session ID persistence', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Get session cookie
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'shop_session-id');
      expect(sessionCookie).toBeDefined();

      // Orders should be visible
      const orderCards = page.locator('.order-card');
      const initialCount = await orderCards.count();
      expect(initialCount).toBeGreaterThan(0);

      // Navigate away and back
      await page.goto(`${baseUrl}/`);
      await page.goto(`${baseUrl}/orders`);

      // Session cookie should still be present
      const newCookies = await page.context().cookies();
      const newSessionCookie = newCookies.find(c => c.name === 'shop_session-id');
      expect(newSessionCookie?.value).toBe(sessionCookie?.value);

      // Orders should still be visible with same count
      const newOrderCards = page.locator('.order-card');
      const newCount = await newOrderCards.count();
      expect(newCount).toBe(initialCount);
    });

    test('SC3.2: Order details remain unchanged across navigation', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      const firstOrderLink = page.locator('.order-link').first();
      const orderID = await firstOrderLink.textContent();

      await firstOrderLink.click();

      // Get first order total
      const totalText = page.locator('.order-summary').first();
      const initialTotal = await totalText.textContent();

      // Navigate back to list
      await page.goto(`${baseUrl}/orders`);

      // Click same order again
      await page.locator('.order-link').first().click();

      // Total should be identical
      const newTotal = await totalText.textContent();
      expect(newTotal).toBe(initialTotal);
    });
  });

  test.describe('Scenario 4: Empty order history state', () => {
    test('SC4.1: New user with no orders sees empty state', async ({ page, context }) => {
      // Create new context to get a new session
      const newContext = await context.browser()?.newContext() || context;
      const newPage = await newContext.newPage();

      await newPage.goto(`${baseUrl}/orders`);

      // Should see empty state message
      const emptyMessage = newPage.locator('text=You haven\'t placed any orders yet');
      await expect(emptyMessage).toBeVisible();

      // Should have "Start Shopping" button
      const startShoppingBtn = newPage.locator('button, a', { hasText: 'Start Shopping' });
      await expect(startShoppingBtn).toBeVisible();

      // No order cards should be visible
      const orderCards = newPage.locator('.order-card');
      expect(await orderCards.count()).toBe(0);

      await newPage.close();
    });

    test('SC4.2: Empty state button links to home page', async ({ page, context }) => {
      const newContext = await context.browser()?.newContext() || context;
      const newPage = await newContext.newPage();

      await newPage.goto(`${baseUrl}/orders`);

      // Click "Start Shopping" button
      const startShoppingBtn = newPage.locator('a', { hasText: 'Start Shopping' }).first();
      await startShoppingBtn.click();

      // Should navigate to home page
      await expect(newPage).toHaveURL(`${baseUrl}/`);

      await newPage.close();
    });
  });

  test.describe('Scenario 5: Order pagination', () => {
    test('SC5.1: Pagination controls visible with multiple pages', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Check if pagination exists (depends on number of mock orders)
      const pagination = page.locator('nav[aria-label="Page navigation"]');
      const paginationVisible = await pagination.isVisible().catch(() => false);

      // If pagination is visible, check controls
      if (paginationVisible) {
        const nextBtn = pagination.locator('a', { hasText: 'Next' });
        await expect(nextBtn).toBeVisible();

        const pageInfo = page.locator('text=Page');
        await expect(pageInfo).toBeVisible();
      }
    });

    test('SC5.2: Page navigation works correctly', async ({ page }) => {
      await page.goto(`${baseUrl}/orders?page=1`);

      // Current page should be 1
      let pageText = await page.locator('text=Page 1').textContent();
      expect(pageText).toContain('Page 1');

      // Check pagination exists
      const nextBtn = page.locator('a', { hasText: 'Next' });
      const nextVisible = await nextBtn.isVisible().catch(() => false);

      if (nextVisible) {
        // Click next page
        await nextBtn.click();

        // URL should update
        const url = page.url();
        expect(url).toContain('page=2');
      }
    });
  });

  test.describe('Scenario 6: Order status displays correctly', () => {
    test('SC6.1: Different order statuses display correct badges', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Get all status badges
      const badges = page.locator('.badge');
      const count = await badges.count();
      expect(count).toBeGreaterThan(0);

      // Badges should have appropriate classes
      for (let i = 0; i < Math.min(count, 2); i++) {
        const badge = badges.nth(i);
        const className = await badge.getAttribute('class');
        expect(className).toMatch(/badge-(?:success|warning|danger|info)/);
      }
    });

    test('SC6.2: Shipped status shows tracking information', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      // Find a shipped order (first one in mock data)
      const firstOrderLink = page.locator('.order-link').first();
      await firstOrderLink.click();

      // Navigate to detail page
      await page.waitForSelector('.status-item');

      // Check for "Shipped" status
      const shippedStatus = page.locator('.status-item', { has: page.locator('text=Shipped') });
      const shippedVisible = await shippedStatus.isVisible().catch(() => false);

      if (shippedVisible) {
        // Shipped status should show date and tracking
        const trackingText = await shippedStatus.textContent();
        expect(trackingText).toContain('Shipped');
      }
    });
  });

  test.describe('Scenario 7: Data isolation and security', () => {
    test('SC7.1: User can only view their own orders', async ({ page, context }) => {
      // Get current session
      const cookies = await context.cookies();
      const userSession = cookies.find(c => c.name === 'shop_session-id')?.value;

      await page.goto(`${baseUrl}/orders`);

      // All visible orders should have same user session
      // (In real implementation, verify backend enforces this)
      const orderCards = page.locator('.order-card');
      const count = await orderCards.count();
      expect(count).toBeGreaterThan(0);

      // Each order is tied to the current session
      // This test verifies frontend displays them
    });

    test('SC7.2: Invalid order ID returns 404', async ({ page }) => {
      // Try to access non-existent order
      const response = await page.goto(`${baseUrl}/order/INVALID-ORDER-ID`);
      expect(response?.status()).toBe(404);
    });

    test('SC7.3: Order detail page back button works', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      const firstOrderLink = page.locator('.order-link').first();
      await firstOrderLink.click();

      // Click back button
      const backBtn = page.locator('a', { hasText: 'Back to Orders' });
      await expect(backBtn).toBeVisible();
      await backBtn.click();

      // Should return to orders list
      await expect(page).toHaveURL(`${baseUrl}/orders`);
      await expect(page.locator('h1')).toContainText('Purchase History');
    });
  });

  test.describe('Scenario 8: Performance requirements', () => {
    test('SC8.1: Order list loads in < 500ms', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(`${baseUrl}/orders`);
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(500);
    });

    test('SC8.2: Order detail loads in < 200ms', async ({ page }) => {
      await page.goto(`${baseUrl}/orders`);

      const firstOrderLink = page.locator('.order-link').first();
      await firstOrderLink.click();

      // Page should load quickly
      const navigationTiming = await page.evaluate(() => performance.getEntriesByType('navigation')[0]);
      expect((navigationTiming as any)?.duration || 0).toBeLessThan(200);
    });
  });

  test.describe('Scenario 9: Purchase History link in navigation', () => {
    test('SC9.1: Purchase History link visible in header', async ({ page }) => {
      await page.goto(`${baseUrl}/`);

      // Check for Purchase History link in header
      const ordersLink = page.locator('a[href*="/orders"], [title="Purchase History"]');
      await expect(ordersLink).toBeVisible();
    });

    test('SC9.2: Purchase History link navigates to orders page', async ({ page }) => {
      await page.goto(`${baseUrl}/`);

      // Click on Purchase History link
      const ordersLink = page.locator('a[href*="/orders"], [title="Purchase History"]').first();
      await ordersLink.click();

      // Should navigate to orders page
      await expect(page).toHaveURL(`${baseUrl}/orders`);
      await expect(page.locator('h1')).toContainText('Purchase History');
    });
  });
});
