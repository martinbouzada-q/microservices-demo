import { test as base } from '@playwright/test';
import * as helpers from './helpers';

/**
 * Test fixtures for E2E tests
 * Extends base test with additional fixtures and setup
 */

type TestFixtures = {
  helpers: typeof helpers;
  authenticatedPage: any;
};

export const test = base.extend<TestFixtures>({
  helpers: async ({}, use) => {
    // Make helpers available in all tests
    await use(helpers);
  },

  authenticatedPage: async ({ page }, use) => {
    // Setup: Clear cookies and navigate to home
    await page.context().clearCookies();
    await page.goto('/');

    // A new session will be created automatically
    // with shop_session-id cookie

    await use(page);

    // Teardown: Optionally clear cookies after test
    // await page.context().clearCookies();
  },
});

export { expect } from '@playwright/test';

/**
 * Test data fixtures
 */

export const testProducts = {
  campMug: {
    id: 'OLJCESPC7Z',
    name: 'Camp Mug',
    price: '$13.99',
  },
  fiftyMilLogo: {
    id: '9SIQT8TOJO',
    name: '50ml Logo',
    price: '$8.99',
  },
  binoculars: {
    id: 'L9ECAV7KIM',
    name: 'Binoculars',
    price: '$24.95',
  },
  blueBottle: {
    id: 'LS4PSXUNUM',
    name: 'Blue Bottle',
    price: '$8.95',
  },
  brownBelt: {
    id: 'TEBAKARI80',
    name: 'Brown Belt',
    price: '$18.99',
  },
};

export const testUsers = {
  newUser: {
    sessionId: null, // Will be set dynamically
  },
  returningUser: {
    sessionId: 'test-session-12345',
  },
};

/**
 * Common test data setups
 */

export async function setupProductInWishlist(page: any, productId: string) {
  await page.goto(`/product/${productId}`);
  const addBtn = page.locator('button:has-text("Add to Wishlist")');
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.waitForURL(/\/product\//);
  }
}

export async function setupMultipleProductsInWishlist(page: any, productIds: string[]) {
  for (const productId of productIds) {
    await setupProductInWishlist(page, productId);
  }
}
