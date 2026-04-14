# End-to-End Tests for Online Boutique

This directory contains Playwright E2E tests for the Online Boutique microservices demo.

## Setup

### Prerequisites

- Node.js 18+ and npm
- Docker (for running the full application stack)
- Running microservices (or docker-compose setup)

### Installation

```bash
cd e2e
npm install
```

## Running Tests

### All Tests

```bash
npm test
```

### Tests in UI Mode (Interactive)

```bash
npm run test:ui
```

This opens an interactive test runner where you can:
- See tests in real-time
- Pause and step through
- View test traces and screenshots
- Re-run specific tests

### Debug Mode

```bash
npm run test:debug
```

This opens the Playwright Inspector with debugger controls.

### Headed Mode (See Browser)

```bash
npm run test:headed
```

Runs tests with browser window visible.

### Run Specific Test File

```bash
npx playwright test tests/wishlist.spec.ts
```

### Run Single Test

```bash
npx playwright test -g "Add product to wishlist from product page"
```

## Test Files

### `wishlist.spec.ts` - Wishlist Feature Tests

10 end-to-end test scenarios covering:

1. **SC01**: Add product to wishlist from product page
2. **SC02**: View wishlist with multiple products
3. **SC03**: Remove product from wishlist
4. **SC04**: Add product to cart from wishlist
5. **SC05**: Empty wishlist displays appropriate message
6. **SC06**: Wishlist prices update with currency conversion
7. **SC07**: Wishlist persists across sessions
8. **SC08**: Adding duplicate product is idempotent
9. **SC09**: Wishlist handles concurrent operations
10. **SC10**: Graceful error handling when service unavailable

Additional tests for navigation and UX.

### `helpers.ts` - Test Utilities

Helper functions for common operations:
- `navigateToProduct()` - Navigate to product page
- `addProductToWishlist()` - Add product to wishlist
- `openWishlist()` - Navigate to wishlist page
- `getWishlistItemCount()` - Get item count
- `getCurrentCurrency()` - Get current currency setting
- `clearWishlist()` - Remove all items
- `verifyWishlistItem()` - Verify product details
- `waitForNetworkIdle()` - Wait for network requests

## Configuration

### `playwright.config.ts`

- **baseURL**: `http://localhost:8080` (set via `BASE_URL` env var)
- **browsers**: Chromium, Firefox, WebKit
- **retries**: 0 locally, 2 in CI
- **reporters**: HTML report
- **screenshots**: Captured on failure
- **videos**: Captured on failure

## Environment Variables

```bash
# Override base URL
BASE_URL=http://localhost:8080 npm test

# Run specific browser
npx playwright test --project=firefox

# Parallel workers
npx playwright test --workers=4
```

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

Reports include:
- Test results
- Screenshots on failure
- Video recordings
- Trace files for debugging

## CI/CD Integration

The `playwright.config.ts` is configured for CI with:
- Retries: 2 attempts
- Workers: 1 (serial)
- Single browser (Chromium recommended)
- forbidOnly: true (prevents `.only` in CI)

Example GitHub Actions workflow:

```yaml
- name: Run E2E Tests
  run: |
    cd e2e
    npm install
    npm test
```

## Debugging

### View Test Trace

```bash
npx playwright show-trace trace.zip
```

### See Network Activity

Network requests are logged in test results when tests fail.

### Screenshot Comparisons

Failed tests capture:
- Before screenshot
- After screenshot (comparison available in HTML report)

## Known Limitations

- Tests require a running backend (configured in `webServer` in config)
- Currency conversion tests depend on upstream services
- Error scenario tests may require service mocking

## Contributing

When adding new tests:

1. Follow the naming convention: `SC##: Clear test name`
2. Include Given-When-Then structure in comments
3. Use helper functions from `helpers.ts`
4. Add descriptive assertions with good error messages
5. Test both happy path and edge cases

Example:

```typescript
test('SC##: Clear description', async ({ page }) => {
  // Given
  await setupInitialState(page);

  // When
  await performAction(page);

  // Then
  await expect(result).toBeDefined();
});
```

## Troubleshooting

### Tests Timeout

- Increase timeout in config or per-test: `test.setTimeout(60000)`
- Check if backend services are running

### Connection Refused

- Ensure `webServer` command in config is correct
- Manually start services before running tests
- Check `BASE_URL` is correct

### Screenshot Comparison Fails

- Update baseline: `npx playwright test --update-snapshots`
- Check for timing issues (add `waitForLoadState`)

## Links

- [Playwright Documentation](https://playwright.dev/)
- [Wishlist Feature Specification](../docs/wishlist-feature.md)
- [API Contract](../src/frontend/genproto/demo.proto)
