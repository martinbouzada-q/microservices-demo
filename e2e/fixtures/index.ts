import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * `freshSession` clears cookies before the test, guaranteeing an empty cart
 * and wishlist on a brand-new `shop_session-id`. Online Boutique has no auth,
 * so this is the cheapest per-test isolation seam.
 */
type Fixtures = {
  freshSession: Page;
};

export const test = base.extend<Fixtures>({
  freshSession: async ({ page }, use) => {
    await page.context().clearCookies();
    await use(page);
  },
});

export { expect };
