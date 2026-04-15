# SCRUM-WISHLIST-001: Add Wishlist Feature to Save Favorite Products

## 📋 User Story

**As a** customer browsing the Online Boutique store
**I want** to save products to a personal wishlist for later review
**So that** I can easily find and reference products I'm interested in without adding them to my cart

---

## 👥 Stakeholders

| Role              | Name              | Responsibility                                      |
| ----------------- | ----------------- | --------------------------------------------------- |
| Product Owner     | TBD               | Acceptance criteria, priority, business value      |
| Backend Engineer  | TBD               | FavoritesService implementation, gRPC contract     |
| Frontend Engineer | TBD               | UI/UX templates, wishlist page, integration points |
| QA Engineer       | TBD               | Test automation, BDD scenario validation           |

---

## 🎯 Success Criteria

1. Users can add products to their wishlist from product and browse pages
2. Users can view a dedicated wishlist page showing all saved products with images, prices, and actions
3. Users can remove products from their wishlist
4. Wishlist data persists for 48 hours (matching session cookie TTL)
5. Wishlist is separate from cart (adding to wishlist does not affect cart state)
6. Performance: wishlist operations complete in < 100ms
7. Zero data loss during concurrent operations (atomic protobuf serialization)

**Metrics**: 
- Wishlist feature adoption rate (% of sessions that use wishlist)
- Average wishlist size per session
- Feature usability (measured via user feedback)

---

## ✅ Acceptance Criteria

### Scenario 1: User adds a product to wishlist from product page

```gherkin
Scenario: User successfully adds a product to wishlist
  Given I am viewing product "OLJCESPC7Z" (Sunglasses)
  And my session ID is "550e8400-e29b-41d4-a716-446655440000"
  And my current wishlist is empty
  When I click "Add to Wishlist" button
  Then the button text changes to "Remove from Wishlist"
  And I see a confirmation message "Added to your wishlist"
  And the product appears in my wishlist
  And my wishlist count badge increments to 1
  And the action completes in < 100ms
```

### Scenario 2: User views their wishlist page

```gherkin
Scenario: User views wishlist with multiple products
  Given I have 3 products in my wishlist:
    | Product ID   | Name        | Price  |
    | OLJCESPC7Z   | Sunglasses  | $19.99 |
    | 66VCHSJNUP   | Tank Top    | $7.99  |
    | 1YMWWN1N4O   | Mug         | $8.99  |
  When I navigate to "/wishlist"
  Then I see a page titled "My Wishlist"
  And each product displays:
    - Product image (thumbnail)
    - Product name
    - Current price (in my selected currency)
    - "Add to Cart" button
    - "Remove from Wishlist" button
  And the wishlist shows "3 items"
  And products are sorted by most recently added (newest first)
```

### Scenario 3: User removes a product from wishlist

```gherkin
Scenario: User removes a product from wishlist
  Given I have "Sunglasses" in my wishlist
  And I am on the wishlist page
  When I click "Remove from Wishlist" button for Sunglasses
  Then the product is removed immediately
  And I see confirmation "Removed from wishlist"
  And my wishlist count decrements to 2
  And the empty state message does NOT appear (still have items)
```

### Scenario 4: User views empty wishlist

```gherkin
Scenario: User views empty wishlist
  Given I have no products in my wishlist
  When I navigate to "/wishlist"
  Then I see the page titled "My Wishlist"
  And a message "Your wishlist is empty"
  And a "Continue Shopping" button linking to "/"
```

### Scenario 5: User adds product from wishlist to cart

```gherkin
Scenario: User adds wishlist product to cart
  Given I have "Sunglasses" in my wishlist
  And my cart is empty
  When I click "Add to Cart" button on the wishlist
  Then the product is added to my cart
  And the product remains in my wishlist (wishlist is independent from cart)
  And I see confirmation "Added to cart"
```

### Scenario 6: Wishlist persists across sessions within TTL

```gherkin
Scenario: Wishlist data persists with session cookie
  Given I have 2 products in my wishlist
  And my session cookie "shop_session-id" is set with 48-hour expiry
  When I close the browser and return after 2 hours
  And my cookie is still valid
  Then my wishlist still contains the same 2 products
```

### Scenario 7: Wishlist expires with session

```gherkin
Scenario: Wishlist clears when session expires
  Given I have products in my wishlist
  And my session cookie "shop_session-id" is about to expire
  When 48 hours elapse (cookie expires)
  And I access the app with a new session ID
  Then my wishlist is empty
```

### Scenario 8: Concurrent wishlist modifications don't lose data

```gherkin
Scenario: Atomic operations prevent race conditions
  Given I have product "A" in my wishlist
  And two requests to add product "B" arrive simultaneously
  When both requests are processed
  Then my wishlist contains exactly 2 products: "A" and "B"
  And no products are lost due to race conditions
```

### Scenario 9: Currency changes don't affect wishlist

```gherkin
Scenario: Wishlist products display in new currency
  Given I have products in my wishlist displaying in USD
  And product prices are: [Sunglasses: $19.99]
  When I change my currency preference to EUR
  And I view my wishlist again
  Then the same products appear
  And prices are converted to EUR (e.g., €18.99)
  And the wishlist data is unchanged
```

### Scenario 10: Error handling - backend service unavailable

```gherkin
Scenario: Graceful failure when FavoritesService is down
  Given the FavoritesService is temporarily unavailable
  When I attempt to add a product to wishlist
  Then I see error message "Unable to save to wishlist. Please try again."
  And the product is NOT added to wishlist
  And the UI remains responsive
  And a retry option is available
```

---

## 🔧 Technical Context

### Current State

- **Cart Service Pattern**: Existing `CartService` (C#/.NET) uses gRPC for add/get/empty operations
- **Frontend Handlers**: Go HTTP handlers (frontend service) parse form data and call backend gRPC services
- **Session Mechanism**: UUID-based `shop_session-id` cookie (48-hour TTL) identifies users
- **Storage**: Pluggable backend (Redis, Spanner, AlloyDB) via `ICartStore` interface
- **Product Identification**: String-based product SKUs from product catalog
- **No Authentication**: All users are anonymous; session ID is sole identifier

### Proposed Changes

1. **Create FavoritesService** (C# gRPC service, parallel to CartService)
   - Methods: `AddFavorite(AddFavoriteRequest)`, `GetFavorites(GetFavoritesRequest)`, `RemoveFavorite(RemoveFavoriteRequest)`, `ClearFavorites(ClearFavoritesRequest)`
   - Storage: Reuse same backend abstraction as CartService (`ICartStore` or new `IFavoritesStore`)
   - Data model: `Favorite { product_id: string, added_at: timestamp }` (no quantity needed)

2. **Extend Frontend Service** (Go)
   - HTTP handlers: `viewWishlistHandler` (GET `/wishlist`), `addToWishlistHandler` (POST `/wishlist/add`), `removeFromWishlistHandler` (POST `/wishlist/remove`)
   - Template: New `wishlist.html` template (similar to `cart.html` but without quantity/checkout)
   - Wishlist badge: Add wishlist item count to header (next to cart badge)

3. **Update Proto Definitions** (`protos/demo.proto`)
   - New `FavoritesService` definition with request/response messages
   - Replicate proto in `src/favoritesservice/src/main/proto/` (following project convention)

4. **Product Listing Markup**
   - Add "Add to Wishlist" button to product pages and browse pages
   - Add wishlist toggle logic (button text changes based on wishlist status)

### Technical Constraints

- **Session-Based Only**: No user authentication; wishlist tied to session ID
- **48-Hour TTL**: Wishlist data expires with session cookie (no explicit cleanup needed)
- **Atomic Operations**: Protobuf serialization must prevent race conditions (read-modify-write pattern)
- **Currency Independence**: Wishlist stores only product IDs; prices calculated at display time
- **Performance**: Operations must complete in < 100ms (monitor via traces)
- **gRPC Communication**: All inter-service communication uses insecure gRPC (TLS delegated to network layer)

### Integration Points

1. **Frontend Service** ↔ **FavoritesService**: gRPC calls to add/remove/get favorites
2. **Frontend Service** ↔ **ProductCatalogService**: Product lookup for wishlist display (name, image, current price)
3. **Frontend Service** ↔ **CurrencyService**: Convert product prices to user's selected currency
4. **Frontend Templates** ↔ **HTTP Handlers**: Server-side rendering of wishlist page
5. **Session Middleware**: Session ID extraction from cookie, passed to all backend services

### Architecture Decisions

| Decision                           | Rationale                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Separate FavoritesService**      | Allows independent scaling, testing, and future enhancements (notifications, sharing). Follows microservices pattern. |
| **Reuse CartStore abstraction**    | Same backend abstraction (Redis/Spanner/AlloyDB) reduces operational complexity and code duplication.      |
| **Session-based identity**         | Consistent with existing cart/checkout model; no auth overhead. Wishlist is ephemeral, not persistent user data. |
| **No Quantity in Favorites**       | Wishlist is for curation (what to buy), not shopping (how many). Quantity belongs in cart only.           |
| **Timestamp in Favorite**          | Enables sorting (most recently added first) and potential future expiry/reminder features.                |
| **Protobuf for storage**           | Consistent with cart service; atomic reads/writes prevent concurrent modification issues.                 |

---

## 🚫 Out of Scope

1. **Persistent user wishlist** (across sessions) — Session-based only
2. **Wishlist sharing** (social features) — No user concept to share with
3. **Wishlist notifications** (price drops, back in stock) — Out of scope for MVP
4. **Wishlist analytics** — Can be added later via event streaming
5. **Mobile app wishlist sync** — No mobile app in scope
6. **Wishlist export** (CSV, PDF) — Future enhancement
7. **Private vs. public wishlist** — Not applicable (no user accounts)

**Future Considerations**: 
- Once user authentication is added, enable persistent cross-session wishlist
- Add wishlist notifications (price drop alerts, restock notifications)
- Implement wishlist sharing and collaborative lists
- Add wishlist analytics to understand customer preferences

---

## ⚠️ Edge Cases & Error Handling

### Edge Cases

1. **Product removed from catalog**
   - **Handling**: Display "Product no longer available" but keep wishlist entry for reference; allow removal from wishlist

2. **Duplicate add attempts**
   - **Handling**: Idempotent operation; adding same product again is no-op, returns success (no error)

3. **Wishlist with 1000+ items**
   - **Handling**: Frontend should paginate (20 items per page); backend must handle large payloads efficiently

4. **Session cookie expires mid-operation**
   - **Handling**: FavoritesService uses session ID from request; expired session creates new empty wishlist; old data remains in storage until TTL cleanup

5. **User switches currency**
   - **Handling**: Wishlist display recalculates prices from product catalog; wishlist data unchanged

6. **Network latency between frontend and FavoritesService**
   - **Handling**: Frontend shows loading state; operations retry up to 3 times with exponential backoff before showing error

### Error Scenarios

| Error Condition                          | User Message                                                  | System Behavior                                   |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| FavoritesService unavailable (500)       | "Unable to update wishlist. Please try again later."          | Log error, return 503 to client, show retry UI   |
| Product not found in catalog             | "This product is no longer available"                         | Display with "Remove from Wishlist" only         |
| Session expired                          | None (transparent); wishlist shows as empty for new session   | Create new session, load empty wishlist          |
| Network timeout (> 5s)                   | "Taking longer than usual. Please refresh if it doesn't work" | Client-side timeout, show retry button           |
| Concurrent modification race condition   | None (operation succeeds transparently)                       | Atomic write prevents data loss                  |
| Wishlist exceeds storage quota           | "Wishlist is full. Remove some items to add more."            | Return error code, guide user to remove items    |

### Data Validation Rules

- **Product ID**: String, 1-20 characters, alphanumeric + underscore only
- **Wishlist Size**: Max 500 items per session (soft limit; beyond triggers warning)
- **Session ID**: Valid UUID format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **Timestamp**: ISO 8601 format (stored server-side, not user input)

---

## 📦 Dependencies

### Blocking

- [ ] None — Wishlist can be developed in parallel with other features

### Related

- **SCRUM-XYZ** — Cart Service (reference implementation pattern for FavoritesService)
- **SCRUM-ABC** — Frontend HTTP routing (reference for wishlist handler registration)
- **SCRUM-DEF** — Session middleware (already exists; no changes needed)

### Infrastructure

- **gRPC**: Already available across all services
- **Redis/Spanner/AlloyDB**: Reuse existing cart backend
- **Go templates**: Already available in frontend service
- **C# / .NET 10.0**: Already available for FavoritesService

---

## 🎓 Definition of Done

### Code Quality

- [ ] Unit test coverage ≥ 80% (FavoritesService)
- [ ] No hardcoded values; use environment variables for service addresses
- [ ] Code follows project conventions (Go handlers, C# service pattern)
- [ ] Proto definitions are clean and follow Google style guide
- [ ] No SQL injection, XSS, or CSRF vulnerabilities

### Testing

- [ ] All 10 BDD scenarios automated (integration tests hitting real services)
- [ ] Load test: 100 concurrent wishlist operations complete in < 100ms
- [ ] Error scenarios tested (service unavailable, timeouts, race conditions)
- [ ] Manual testing: wishlist page renders correctly across screen sizes

### Documentation

- [ ] Proto definitions documented (request/response fields)
- [ ] Frontend handlers documented (request/response format)
- [ ] Environment variables documented (FAVORITES_SERVICE_ADDR, etc.)
- [ ] Troubleshooting guide for common issues (service down, data loss)

### Review & Deployment

- [ ] Code reviewed and approved (1+ reviewer)
- [ ] PR merged to main branch
- [ ] All CI checks passing (linting, type checking, tests)
- [ ] Feature flag: Wishlist enabled by default (no rollout needed)
- [ ] Monitoring: Wishlist operation latency tracked in traces

### Infrastructure

- [ ] FavoritesService deployed and healthy
- [ ] gRPC communication latency monitored (target: < 50ms)
- [ ] Storage backend (Redis) has sufficient memory
- [ ] Traces exported to collector for observability

---

## 📝 Implementation Notes

**For Backend Engineer (FavoritesService)**:
- Reference `src/cartservice/src/services/CartService.cs` for gRPC service pattern
- Reuse storage layer: `ICartStore` interface or create `IFavoritesStore` (recommend reuse)
- Implement idempotent `AddFavorite` (no duplicates in list)
- Use protobuf serialization for atomic reads/writes
- Environment variable: `FAVORITES_SERVICE_ADDR` for frontend to call

**For Frontend Engineer**:
- Reference `src/frontend/handlers.go` for handler patterns (`sessionID(r)` usage)
- Reference `src/frontend/templates/cart.html` for UI layout
- Add wishlist link to header navigation and product pages
- Implement wishlist count badge (similar to cart badge)
- Use form POST for state changes (add/remove), GET for read
- Ensure currency conversion works on wishlist page (leverage existing CurrencyService)

**For QA Engineer**:
- Test with multiple concurrent sessions (verify no cross-session data leakage)
- Test session expiry boundary (47h 59m vs 48h 1m)
- Test with very large wishlist (500+ items)
- Verify wishlist persists across page reloads
- Test error scenarios: service down, network timeout, invalid product IDs

**Known Gotchas**:
- **No user accounts**: Wishlist is tied to session ID, not user ID. Session expires after 48 hours.
- **Protobuf atomicity**: Ensure backend uses read-modify-write pattern atomically (no partial updates).
- **Race conditions**: Two simultaneous adds of the same product should be idempotent (no duplicates).
- **Storage cleanup**: Old wishlist data (expired sessions) should be cleaned up by cache TTL, not explicit deletion.

---

## 🔗 References

- **Cart Service Reference**: `src/cartservice/src/services/CartService.cs`
- **Frontend Handlers Pattern**: `src/frontend/handlers.go` (specifically `addToCartHandler`, `viewCartHandler`)
- **Cart Template**: `src/frontend/templates/cart.html`
- **Proto Definition**: `protos/demo.proto`
- **Session Middleware**: `src/frontend/middleware.go` (ensureSessionID function)
- **Product Catalog**: `src/productcatalogservice/products.json`

---

**Metadata**:
- **Created**: 2026-04-14
- **Created By**: Claude SDD Generator (from input: "Agregar wishlist para guardar productos favoritos")
- **INVEST Validated**: ✅ (All criteria met; estimated 5-7 days)
- **BDD Scenarios**: 10 (comprehensive coverage of happy path, edge cases, errors)
- **Priority**: Medium (nice-to-have feature; no blocking dependencies)
- **Labels**: `feature`, `sdd`, `microservices`, `frontend`, `backend`
