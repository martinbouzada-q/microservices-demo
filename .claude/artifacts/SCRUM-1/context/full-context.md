# SCRUM-1: Add Wishlist Feature to Save Favorite Products

## User Story

**As a** customer browsing the Online Boutique store  
**I want** to save products to a personal wishlist for later review  
**So that** I can easily find and reference products I'm interested in without adding them to my cart

## Stakeholders

| **Role** | **Name** | **Responsibility** |
| --- | --- | --- |
| Product Owner | TBD | Acceptance criteria, priority, business value |
| Backend Engineer | TBD | FavoritesService implementation, gRPC contract |
| Frontend Engineer | TBD | UI/UX templates, wishlist page, integration points |
| QA Engineer | TBD | Test automation, BDD scenario validation |

## Success Criteria

* Users can add products to their wishlist from product and browse pages
* Users can view a dedicated wishlist page showing all saved products with images, prices, and actions
* Users can remove products from their wishlist
* Wishlist data persists for 48 hours (matching session cookie TTL)
* Wishlist is separate from cart (adding to wishlist does not affect cart state)
* Performance: wishlist operations complete in < 100ms
* Zero data loss during concurrent operations (atomic protobuf serialization)

**Metrics:**
* Wishlist feature adoption rate (% of sessions that use wishlist)
* Average wishlist size per session
* Feature usability (measured via user feedback)

## Technical Context

### Current State

* **Cart Service Pattern**: Existing `CartService` (C#/.NET) uses gRPC for add/get/empty operations
* **Frontend Handlers**: Go HTTP handlers (frontend service) parse form data and call backend gRPC services
* **Session Mechanism**: UUID-based `shop_session-id` cookie (48-hour TTL) identifies users
* **Storage**: Pluggable backend (Redis, Spanner, AlloyDB) via `ICartStore` interface
* **Product Identification**: String-based product SKUs from product catalog
* **No Authentication**: All users are anonymous; session ID is sole identifier

### Proposed Changes

1. **Create FavoritesService** (C# gRPC service, parallel to CartService)
   - Methods: `AddFavorite`, `GetFavorites`, `RemoveFavorite`, `ClearFavorites`
   - Storage: Reuse same backend abstraction as CartService (`ICartStore` or new `IFavoritesStore`)
   - Data model: `{Favorite { product_id: string, added_at: timestamp }}`

2. **Extend Frontend Service** (Go)
   - HTTP handlers: `viewWishlistHandler` (GET `/wishlist`), `addToWishlistHandler` (POST `/wishlist/add`), `removeFromWishlistHandler` (POST `/wishlist/remove`)
   - Template: New `wishlist.html` template (similar to `cart.html` but without quantity/checkout)
   - Wishlist badge: Add wishlist item count to header (next to cart badge)

3. **Update Proto Definitions** (`protos/demo.proto`)
   - New `FavoritesService` definition with request/response messages
   - Replicate proto in `src/favoritesservice/src/main/proto/`

4. **Product Listing Markup**
   - Add "Add to Wishlist" button to product pages and browse pages
   - Add wishlist toggle logic (button text changes based on wishlist status)

### Technical Constraints

* **Session-Based Only**: No user authentication; wishlist tied to session ID
* **48-Hour TTL**: Wishlist data expires with session cookie (no explicit cleanup needed)
* **Atomic Operations**: Protobuf serialization must prevent race conditions (read-modify-write pattern)
* **Currency Independence**: Wishlist stores only product IDs; prices calculated at display time
* **Performance**: Operations must complete in < 100ms (monitor via traces)
* **gRPC Communication**: All inter-service communication uses insecure gRPC (TLS delegated to network layer)

### Architecture Decisions

| **Decision** | **Rationale** |
| --- | --- |
| **Separate FavoritesService** | Allows independent scaling, testing, and future enhancements. Follows microservices pattern. |
| **Reuse CartStore abstraction** | Same backend abstraction (Redis/Spanner/AlloyDB) reduces operational complexity and code duplication. |
| **Session-based identity** | Consistent with existing cart/checkout model; no auth overhead. Wishlist is ephemeral, not persistent user data. |
| **No Quantity in Favorites** | Wishlist is for curation (what to buy), not shopping (how many). Quantity belongs in cart only. |
| **Timestamp in Favorite** | Enables sorting (most recently added first) and potential future expiry/reminder features. |
| **Protobuf for storage** | Consistent with cart service; atomic reads/writes prevent concurrent modification issues. |

## Acceptance Criteria (BDD Scenarios)

### Scenario 1: User adds a product to wishlist from product page
```gherkin
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
Given I have 3 products in my wishlist with prices and names
When I navigate to "/wishlist"
Then I see a page titled "My Wishlist"
And each product displays image, name, price, "Add to Cart" and "Remove from Wishlist" buttons
And the wishlist shows "3 items"
And products are sorted by most recently added (newest first)
```

### Scenario 3: User removes a product from wishlist
```gherkin
Given I have "Sunglasses" in my wishlist
And I am on the wishlist page
When I click "Remove from Wishlist" button for Sunglasses
Then the product is removed immediately
And I see confirmation "Removed from wishlist"
And my wishlist count decrements
```

### Scenario 4: User views empty wishlist
```gherkin
Given I have no products in my wishlist
When I navigate to "/wishlist"
Then I see "Your wishlist is empty"
And a "Continue Shopping" button linking to "/"
```

### Scenario 5: User adds product from wishlist to cart
```gherkin
Given I have "Sunglasses" in my wishlist
And my cart is empty
When I click "Add to Cart" button on the wishlist
Then the product is added to my cart
And the product remains in my wishlist
And I see confirmation "Added to cart"
```

### Scenario 6: Wishlist persists across sessions within TTL
```gherkin
Given I have 2 products in my wishlist
And my session cookie "shop_session-id" is set with 48-hour expiry
When I close the browser and return after 2 hours
And my cookie is still valid
Then my wishlist still contains the same 2 products
```

### Scenario 7: Wishlist expires with session
```gherkin
Given I have products in my wishlist
When 48 hours elapse (cookie expires)
And I access the app with a new session ID
Then my wishlist is empty
```

### Scenario 8: Concurrent wishlist modifications don't lose data
```gherkin
Given I have product "A" in my wishlist
And two requests to add product "B" arrive simultaneously
When both requests are processed
Then my wishlist contains exactly 2 products: "A" and "B"
And no products are lost due to race conditions
```

### Scenario 9: Currency changes don't affect wishlist
```gherkin
Given I have products in my wishlist displaying in USD with price $19.99
When I change my currency preference to EUR
And I view my wishlist again
Then the same products appear with prices converted to EUR
And the wishlist data is unchanged
```

### Scenario 10: Error handling - backend service unavailable
```gherkin
Given the FavoritesService is temporarily unavailable
When I attempt to add a product to wishlist
Then I see error message "Unable to save to wishlist. Please try again."
And the product is NOT added to wishlist
And a retry option is available
```

## Edge Cases & Error Handling

### Edge Cases
1. **Product removed from catalog** → Display "Product no longer available" but keep wishlist entry
2. **Duplicate add attempts** → Idempotent operation (no duplicates)
3. **Wishlist with 1000+ items** → Frontend paginates (20 items per page)
4. **Session cookie expires mid-operation** → FavoritesService uses session ID; old data remains until TTL
5. **User switches currency** → Wishlist display recalculates prices from product catalog
6. **Network latency** → Frontend shows loading state; retry up to 3 times with exponential backoff

## Definition of Done

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

## Implementation Notes

### For Backend Engineer (FavoritesService)
* Reference `src/cartservice/src/services/CartService.cs` for gRPC service pattern
* Reuse storage layer: `ICartStore` interface
* Implement idempotent `AddFavorite` (no duplicates in list)
* Use protobuf serialization for atomic reads/writes
* Environment variable: `FAVORITES_SERVICE_ADDR` for frontend to call

### For Frontend Engineer
* Reference `src/frontend/handlers.go` for handler patterns (`sessionID(r)` usage)
* Reference `src/frontend/templates/cart.html` for UI layout
* Add wishlist link to header navigation and product pages
* Implement wishlist count badge (similar to cart badge)
* Use form POST for state changes (add/remove), GET for read
* Ensure currency conversion works on wishlist page (leverage existing CurrencyService)

### For QA Engineer
* Test with multiple concurrent sessions (verify no cross-session data leakage)
* Test session expiry boundary (47h 59m vs 48h 1m)
* Test with very large wishlist (500+ items)
* Verify wishlist persists across page reloads
* Test error scenarios: service down, network timeout, invalid product IDs

## Dependencies
- None (blocking) — Wishlist can be developed in parallel with other features

## INVEST Validation
- **Independent**: ✅ Can be developed in parallel
- **Negotiable**: ✅ Implementation approach flexible
- **Valuable**: ✅ Clear business value (customer convenience)
- **Estimable**: ✅ Clear technical scope (5-7 days)
- **Small**: ⚠️ At boundary (5-7 days estimated, recommend splitting if needed)
- **Testable**: ✅ 10 BDD scenarios provide clear test criteria

---

**Priority**: Medium | **Labels**: feature, sdd, microservices, frontend, backend
**Status**: To Do | **Sprint**: SCRUM Sprint 1 (active)
