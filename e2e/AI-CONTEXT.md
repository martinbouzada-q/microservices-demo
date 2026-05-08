# E2E AI Context — microservices-demo (Online Boutique)

> Read this file FIRST before planning or implementing any E2E test.
> Update it whenever you add a Page Object, fixture, helper, or API helper.

## Structure
- e2eRoot: e2e
- pages: pages
- fixtures: fixtures
- api: api
- specs: specs
- config: config
- authSetup: (none)                  # no auth — see "Auth" below
- playwrightConfig: e2e/playwright.config.ts
- storageStateDir: (none)

## Stack
- Frontend: Go server-rendered HTML templates served by `src/frontend/` (gorilla/mux)
- Backend: gRPC microservices (cart, checkout, productcatalog, currency, shipping, recommendation, ad, favorites, shoppingassistant, email, payment)
- Auth: NONE. Sessions tracked via `shop_session-id` cookie (auto-created on first request, 48h TTL). No login UI, no users, no roles.
- API base URL: `e2e/config/urls.ts` (sourced from `BASE_URL` env var or `TEST_ENV`, defaults to `http://localhost:8080`)
- Realtime: none

## Existing Page Objects (REUSE before creating new)
| Page Object       | File                              | Covers screen                                |
|-------------------|-----------------------------------|----------------------------------------------|
| BasePage          | e2e/pages/base.page.ts            | shared cart/wishlist badge + toast utilities |
| HomePage          | e2e/pages/home.page.ts            | `/` — product grid, wishlist quick-add       |
| ProductPage       | e2e/pages/product.page.ts         | `/product/:id` — wishlist toggle, add-to-cart|
| CartPage          | e2e/pages/cart.page.ts            | `/cart` — line items, empty state            |
| WishlistPage      | e2e/pages/wishlist.page.ts        | `/wishlist` — items, remove, add-to-cart     |
| OrdersPage        | e2e/pages/orders.page.ts          | `/orders` — purchase history list            |
| OrderDetailPage   | e2e/pages/order-detail.page.ts    | `/order/:id` — timeline, items, summary      |

Re-export barrel at `e2e/pages/index.ts`.

## Existing Fixtures
| Fixture       | File                       | Provides                                                |
|---------------|----------------------------|---------------------------------------------------------|
| freshSession  | e2e/fixtures/index.ts      | a `Page` with cookies cleared (fresh `shop_session-id`) |

Static catalog data: `e2e/fixtures/data.ts` exports `testProducts` keyed by name (sunglasses, tankTop, watch, loafers, hairdryer) — all IDs verified against `src/productcatalogservice/products.json`.

## Existing API Helpers (prefer over UI for setup/teardown)
Frontend HTTP form endpoints — usable from `request: APIRequestContext`:
| Helper                                    | File                       | Calls                          |
|-------------------------------------------|----------------------------|--------------------------------|
| api.cart.add(req, productId, qty?)        | e2e/api/cart.api.ts        | POST `/cart` (form)            |
| api.cart.addAjax(req, productId, qty?)    | e2e/api/cart.api.ts        | POST `/api/cart/add` (JSON)    |
| api.cart.empty(req)                       | e2e/api/cart.api.ts        | POST `/cart/empty`             |
| api.wishlist.add(req, productId)          | e2e/api/wishlist.api.ts    | POST `/wishlist/add`           |
| api.wishlist.remove(req, productId)       | e2e/api/wishlist.api.ts    | POST `/wishlist/remove`        |
| api.currency.set(req, currencyCode)       | e2e/api/currency.api.ts    | POST `/setCurrency`            |

Barrel at `e2e/api/index.ts` exports the `api` namespace.

## Conventions for setup/teardown
- Use `freshSession` fixture for per-test isolation (clears cookies → empty cart + wishlist on a new `shop_session-id`).
- Prefer `api.*` calls for arrange (e.g. seed wishlist) — UI is reserved for what the test actually asserts.
- `request` from Playwright fixtures inherits the page's storage state, so `api.wishlist.add(request, ...)` operates on the same session as the `freshSession` page.
- No login flow exists, so no `auth.setup.ts` / `storageState`.

## Known gotchas
- Catalog product IDs are stable strings. Use `testProducts.<key>` from `fixtures/data.ts`, never hardcode.
- The frontend renders Go templates server-side. Form `POST` actions return 303 redirects, not JSON — `res.ok()` evaluates to true but treat 303 explicitly when asserting.
- `/api/cart/add` is the AJAX endpoint (returns JSON); `/cart` POST is the legacy form fallback (redirects).
- All inter-service calls are gRPC; the browser never sees them. `page.waitForResponse` only works for frontend HTTP routes.
- `favoritesservice` and `cartservice` depend on Redis; if either is down the UI returns 500 and tests fail with cryptic template errors.
- `BASE_URL` overrides `TEST_ENV`. CI must set one of them.
- Spec naming: `<feature>.e2e.spec.ts` under `e2e/specs/` (configured via `testMatch`).
- Three open bugs are marked with `test.fixme` in `add-to-cart.e2e.spec.ts` (SCRUM-20 quantity badge, SCRUM-21 keyboard submit, SCRUM-22 unexpected scroll). Remove `.fixme` once fixed.

## Out of scope for E2E
- Visual regression (separate skill/tool — `capture-before-screenshots.js` exists for ad-hoc baselines).
- gRPC contract tests (handled at service level).
- Unit tests (Go/C#/Java/Python — handled per service).
