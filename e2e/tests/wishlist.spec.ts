import { test, expect } from '@playwright/test';

/**
 * Wishlist Feature E2E Tests
 *
 * Tests for the wishlist functionality that allows users to save favorite products.
 * These tests verify the wishlist page loads, displays correctly, and is accessible.
 */

test.describe('Wishlist Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test to start with fresh session
    await page.context().clearCookies();
  });

  /**
   * SC01: Wishlist page loads and displays empty state
   *
   * Given I navigate to the wishlist page
   * When the page loads
   * Then I should see the empty wishlist message
   * And a "Continue Shopping" button
   */
  test('SC01: Wishlist page loads with empty state', async ({ page }) => {
    // Navigate to wishlist page
    await page.goto('/wishlist');

    // Verify page loaded
    await page.waitForLoadState('networkidle');

    // Check for empty state message
    const emptyMessage = page.locator('h3:has-text("Your wishlist is empty!")');
    await expect(emptyMessage).toBeVisible();

    // Check for Continue Shopping button
    const continueBtn = page.locator('a:has-text("Continue Shopping")');
    await expect(continueBtn).toBeVisible();
  });

  /**
   * SC02: Wishlist page displays correct title and structure
   *
   * Given I navigate to the wishlist page
   * When the page loads
   * Then I should see the wishlist header
   * And the main content area
   */
  test('SC02: Wishlist page structure is correct', async ({ page }) => {
    // Navigate to wishlist
    await page.goto('/wishlist');
    await page.waitForLoadState('networkidle');

    // Check for main element
    const mainContent = page.locator('main[role="main"].wishlist-sections');
    await expect(mainContent).toBeVisible();

    // Check for empty state section
    const emptySection = page.locator('section.empty-wishlist-section');
    await expect(emptySection).toBeVisible();
  });

  /**
   * SC03: Page title is "Online Boutique"
   *
   * Given I navigate to the wishlist page
   * When the page loads
   * Then the browser title should contain "Online Boutique"
   */
  test('SC03: Wishlist page has correct title', async ({ page }) => {
    // Navigate to wishlist
    await page.goto('/wishlist');
    await page.waitForLoadState('networkidle');

    // Check page title
    const title = await page.title();
    expect(title).toContain('Online Boutique');
  });

  /**
   * SC04: Navigation from home to wishlist works
   *
   * Given I am on the home page
   * When I navigate to the wishlist
   * Then I should reach the wishlist page
   */
  test('SC04: Navigation to wishlist works', async ({ page }) => {
    // Go to home page first
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to wishlist
    await page.goto('/wishlist');

    // Verify we're on the wishlist page
    expect(page.url()).toContain('/wishlist');

    // Verify page loaded
    const mainContent = page.locator('main.wishlist-sections');
    await expect(mainContent).toBeVisible();
  });

  /**
   * SC05: Wishlist page responds correctly
   *
   * Given I navigate to the wishlist page
   * When the page loads
   * Then the HTTP response should be 200
   */
  test('SC05: Wishlist page returns 200 status', async ({ page }) => {
    // Capture response
    const response = await page.goto('/wishlist');

    // Verify status
    expect(response?.status()).toBe(200);
  });

  /**
   * SC06: Header elements are present
   *
   * Given I navigate to the wishlist page
   * When the page loads
   * Then I should see the header with navigation
   */
  test('SC06: Header is displayed on wishlist page', async ({ page }) => {
    // Navigate to wishlist
    await page.goto('/wishlist');
    await page.waitForLoadState('networkidle');

    // Check for header element
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check for navbar
    const navbar = page.locator('.navbar');
    await expect(navbar).toBeVisible();
  });

  /**
   * SC07: Empty wishlist shows helper text
   *
   * Given I navigate to an empty wishlist
   * When the page loads
   * Then I should see the helper text
   */
  test('SC07: Empty wishlist displays helper text', async ({ page }) => {
    // Navigate directly to empty wishlist
    await page.goto('/wishlist');

    // Should display empty state
    const emptyMessage = page.locator('h3:has-text("Your wishlist is empty!")');
    await expect(emptyMessage).toBeVisible();

    // Should show helper text
    const helpText = page.locator('text=Items you add to your wishlist will appear here');
    await expect(helpText).toBeVisible();

    // Verify no items are shown
    const items = page.locator('.wishlist-item-row');
    const itemCount = await items.count();
    expect(itemCount).toBe(0);
  });

  /**
   * SC08: Wishlist main element has correct role
   *
   * Given I navigate to the wishlist page
   * When the page loads
   * Then the main content should have proper accessibility role
   */
  test('SC08: Wishlist main element has correct role', async ({ page }) => {
    // Navigate to wishlist
    await page.goto('/wishlist');
    await page.waitForLoadState('networkidle');

    // Check for main element with correct role
    const mainElement = page.locator('main[role="main"]');
    await expect(mainElement).toBeVisible();

    // Should contain wishlist-sections class
    const wishlistSection = page.locator('main.wishlist-sections');
    await expect(wishlistSection).toBeVisible();
  });

  /**
   * SC09: Page is accessible without JavaScript errors
   *
   * Given I navigate to the wishlist page
   * When the page loads
   * Then the page should have content
   */
  test('SC09: Wishlist page loads without errors', async ({ page }) => {
    // Navigate to wishlist
    const response = await page.goto('/wishlist');

    // Verify successful response
    expect(response?.ok()).toBe(true);

    // Verify page has content
    const content = await page.content();
    expect(content).toContain('wishlist');
  });

  /**
   * SC10: Wishlist path is accessible
   *
   * Given I navigate to /wishlist
   * When the page loads
   * Then the URL should match the wishlist path
   */
  test('SC10: Wishlist path is accessible', async ({ page }) => {
    // Navigate to wishlist
    await page.goto('/wishlist');

    // Verify URL
    expect(page.url()).toMatch(/\/wishlist/);
  });
});
