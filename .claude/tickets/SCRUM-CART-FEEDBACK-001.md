# SCRUM-CART-FEEDBACK-001: Improve Visual Feedback for Add-to-Cart Actions

## 📋 User Story

**As a** customer shopping for products in the Online Boutique store
**I want** to receive immediate visual confirmation when I add items to my cart
**So that** I have clear feedback that my action was successful and I can see the updated cart status without navigating away

---

## 👥 Stakeholders

| Role              | Name              | Responsibility                                      |
| ----------------- | ----------------- | --------------------------------------------------- |
| Product Owner     | TBD               | Acceptance criteria, priority, feedback UX spec    |
| Frontend Engineer | TBD               | UI/UX implementation, template updates, JavaScript |
| QA Engineer       | TBD               | Test automation, visual regression testing         |
| Backend Engineer  | TBD               | API response optimization, latency monitoring      |

---

## 🎯 Success Criteria

1. Add-to-cart action provides immediate visual feedback (< 200ms perceived latency)
2. User receives confirmation message (toast/inline notification) without page navigation
3. Cart badge in header updates in real-time showing new item count
4. Success feedback remains visible for 3-5 seconds before fading
5. Error scenarios display error messages with retry capability
6. Button state changes during request (loading/disabled state)
7. Works on all supported screen sizes (mobile, tablet, desktop)
8. Accessible: ARIA live regions announce cart additions for screen reader users
9. Performance: Add-to-cart request completes in < 100ms
10. 100% of add-to-cart interactions include feedback (zero silent failures)

**Metrics**:
- Time-to-feedback perception (user perceives confirmation within 200ms)
- Completion rate (% of add-to-cart clicks resulting in visible feedback)
- Error recovery rate (% of errors recovered via retry)
- User satisfaction (measured via session analytics if tracking is enabled)

---

## ✅ Acceptance Criteria

### Scenario 1: User successfully adds product to cart with feedback

```gherkin
Scenario: User sees confirmation after adding product to cart
  Given I am viewing product "OLJCESPC7Z" (Sunglasses)
  And my cart currently has 0 items
  When I select quantity "2" from the dropdown
  And I click the "Add To Cart" button
  Then the button shows a loading state (spinner or text change)
  And within 200ms, I see a success toast message "Added 2 items to cart"
  And the cart badge in header updates from "0" to "2"
  And the success toast fades after 4 seconds
  And I remain on the product page (no navigation)
  And the button returns to normal "Add To Cart" state
```

### Scenario 2: User sees error feedback and recovery option

```gherkin
Scenario: User sees error when cart service is unavailable
  Given I am viewing a product
  And the CartService is temporarily unavailable
  When I click "Add To Cart"
  Then the button shows loading state briefly
  And I see error message "Unable to add to cart. Please try again."
  And the error message includes a retry button
  And the cart badge does NOT update
  When I click the retry button
  Then the request is retried
  And if successful, I see the success feedback
```

### Scenario 3: Cart badge updates in real-time

```gherkin
Scenario: Cart badge reflects new item count immediately
  Given I am on the home page
  And the cart badge shows "0" in the header
  And my cart contains 0 items
  When I click "Add To Cart" on a product (quantity: 3)
  Then the success message appears
  And the cart badge immediately changes from "0" to "3"
  And the badge update happens before the toast disappears
  And the badge number is accurate regardless of page location
```

### Scenario 4: Add-to-cart button shows loading state

```gherkin
Scenario: Button provides visual feedback during request
  Given I am on a product page
  When I click the "Add To Cart" button
  Then the button immediately shows a loading indicator
  And the button text changes (e.g., "Adding..." or "Loading...")
  And the button is disabled (no double-clicks possible)
  And the loading state persists until the response arrives (< 100ms)
  When the request completes successfully
  Then the button returns to "Add To Cart" state
  And the button is enabled again
```

### Scenario 5: Multiple rapid add-to-cart clicks don't create duplicates

```gherkin
Scenario: Rapid button clicks are debounced
  Given I am on a product page
  When I rapidly click "Add To Cart" button 3 times in 100ms
  Then only 1 add-to-cart request is sent
  And the quantity reflects 1 item added (from single request)
  And I see only 1 success toast
  And the cart badge updates correctly
```

### Scenario 6: Success feedback on home/browse page with quantity

```gherkin
Scenario: Add-to-cart from home page shows feedback inline
  Given I am on the home page with multiple products displayed
  And I can see product cards with inline "Add To Cart" buttons
  When I click "Add To Cart" on a specific product card
  Then the button on that specific card shows loading state
  And a success toast appears near the product or at page top
  And the cart badge updates
  And only that product's button is affected (others remain normal)
```

### Scenario 7: Error handling with descriptive messages

```gherkin
Scenario: Different errors show different messages
  Given I am adding products to cart
  When various error conditions occur:
    | Error Condition | User Message | Recovery |
    | Service unavailable | "Cart service temporarily unavailable" | Retry button |
    | Invalid quantity | "Please select a valid quantity" | Highlight input |
    | Product not found | "This product is no longer available" | None (remove button) |
    | Session expired | "Session expired, please refresh page" | Refresh button |
  Then the user sees the appropriate message
  And recovery options are clearly presented
```

### Scenario 8: Toast message auto-dismisses but can be closed manually

```gherkin
Scenario: Success toast provides auto-dismiss and manual close
  Given a success toast is displayed
  When I do nothing
  Then the toast automatically dismisses after 4 seconds
  And the fade-out animation takes 500ms
  When I click the X button on the toast before it auto-dismisses
  Then the toast immediately closes
  And no animation is blocked
```

### Scenario 9: Accessibility - screen reader announces cart addition

```gherkin
Scenario: Screen reader announces add-to-cart success
  Given I am using a screen reader
  And I navigate to product page with keyboard
  When I press Enter on "Add To Cart" button
  Then the screen reader announces "Added 1 item to cart"
  And the cart badge count is announced as "Cart updated, now contains X items"
  And the announcement happens within 500ms of button click
```

### Scenario 10: Mobile responsiveness of feedback UI

```gherkin
Scenario: Feedback UI is optimized for mobile screens
  Given I am using a mobile device (viewport < 600px)
  When I add a product to cart
  Then the success toast is appropriately sized for mobile
  And the toast text is readable (font size >= 14px)
  And the toast does not overlap interactive elements
  And the button loading state is visible on small screens
  And touch targets remain adequate (>= 48px height)
```

---

## 🔧 Technical Context

### Current State

- **Add-to-Cart Flow**: Form submission (POST /cart) with server-side redirect to /cart page
- **Button**: Standard HTML `<button>` in product.html template (line 69)
- **Feedback**: None (silent redirect)
- **Cart Badge**: Static header badge showing cart count, updates only on page reload
- **Handler**: `addToCartHandler` in frontend/handlers.go (lines 211-237)
- **Response**: 302 Found redirect to /cart (no data returned)
- **Latency**: ~50-100ms typical (depends on CartService and ProductCatalogService calls)

### Proposed Changes

1. **Frontend Template Updates** (product.html, home.html)
   - Add loading state CSS classes and spinner icon
   - Add inline error message container
   - Add ARIA live region for screen reader announcements

2. **New Client-Side JavaScript Module** (add-to-cart.js)
   - Intercept form submit events
   - Convert form submission to fetch API call (AJAX)
   - Handle loading states
   - Display toast notifications
   - Update cart badge dynamically
   - Implement error retry logic
   - Debounce rapid clicks

3. **Backend Response Enhancement** (addToCartHandler)
   - Return JSON response with new cart size instead of redirect
   - Response format: `{ "success": true, "cartSize": 2, "message": "Added to cart" }`
   - Include error codes for client-side error handling
   - HTTP 200 (success) or 4xx/5xx (error) instead of 302

4. **Cart Badge Component Update** (header.html, CSS)
   - Make cart badge dynamic (data-cart-size attribute)
   - Add CSS transition animation for count changes
   - Update via JavaScript after add-to-cart

5. **Toast Notification System** (new: toast.html template + toast.js)
   - Reusable toast component for all notifications
   - CSS animation for slide-in and fade-out
   - Auto-dismiss timer (4 seconds default)
   - Close button (X) for manual dismiss

### Technical Constraints

- **No Page Navigation**: Stay on current page after add-to-cart
- **AJAX Not Form Submit**: Use fetch API for background request
- **Backward Compatibility**: Non-JavaScript fallback still works (form submit)
- **Performance**: Add-to-cart + feedback must complete in < 100ms
- **Accessibility**: WCAG 2.1 AA compliance (ARIA live regions, keyboard navigation)
- **No New Dependencies**: Use vanilla JavaScript (no jQuery or heavy libraries)
- **Cross-Browser**: Support modern browsers (Chrome, Firefox, Safari, Edge)
- **Mobile-First**: Design feedback for small screens first

### Integration Points

1. **Frontend Service** ↔ **CartService**: Existing gRPC call (no changes needed)
2. **Frontend Templates** ↔ **JavaScript**: New add-to-cart.js module
3. **Frontend Handlers** ↔ **Response Format**: JSON instead of 302 redirect
4. **Header Template** ↔ **Cart Badge**: Dynamic update via data attributes
5. **Toast System** ↔ **All Pages**: Reusable component for future notifications

### Architecture Decisions

| Decision                           | Rationale                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **AJAX instead of form submit**    | Allows staying on product page, faster feedback, better UX control                                       |
| **Fetch API (not jQuery/axios)**   | Vanilla JS reduces bundle size, no external dependency, widely supported                                 |
| **JSON response from backend**     | Structured data for client to handle, enables real-time cart updates                                     |
| **Toast notification system**      | Consistent feedback pattern for all operations, reusable for future features                             |
| **Debouncing rapid clicks**        | Prevents accidental double-adds, improves backend load                                                    |
| **No page reload on success**      | Better perceived performance, user stays in context                                                      |
| **Fallback form submit**           | Graceful degradation for clients without JavaScript                                                      |
| **ARIA live region**               | Accessibility-first approach, announces changes to screen readers                                        |

---

## 🚫 Out of Scope

1. **Persistent cart visualization** across tabs/windows — single-session scope
2. **Server-sent events (SSE)** for real-time cart sync — session-based cart is ephemeral
3. **Animation library** (e.g., Framer Motion) — use CSS animations only
4. **Add-to-cart from search results** — handle only product pages and home page
5. **Cart quantity increment** (pre-existing items) — always new entry, no aggregation logic
6. **Wishlist integration** — separate feature (SCRUM-1)
7. **A/B testing framework** — measure success via baseline analytics
8. **PWA/offline support** — requires network for cart operations anyway

**Future Considerations**:
- Expand to all pages with add-to-cart (search, category filters when SCRUM-4 completed)
- Add confetti animation or product bounce-in on successful add
- Integrate with shoppingassistantservice for AI-powered recommendations on add
- Add cart summary preview in toast (show product name, image in notification)
- Implement undo/remove recent item feature

---

## ⚠️ Edge Cases & Error Handling

### Edge Cases

1. **Session expires mid-request**
   - Handling: Show "Session expired" error with refresh button; old cart data expires after 48hr TTL

2. **Product removed from catalog**
   - Handling: Show "Product no longer available" error; UI prevents adding by disabling button

3. **Cart storage quota exceeded** (e.g., > 100 items)
   - Handling: Show "Cart is full" error; user must remove items before adding more

4. **Network latency spike** (> 5 seconds)
   - Handling: Show "Taking longer than usual..." message after 2s; provide manual retry

5. **Rapid add-to-cart with same product**
   - Handling: Debounce to single request; show "Added X items" (single request result)

6. **User adds duplicate product while loading**
   - Handling: Lock button during request; queue second request if user re-clicks after first completes

7. **Toast notification spam** (multiple rapid adds)
   - Handling: Stack toasts or consolidate (show "Added 5 items in 2 operations")

8. **Browser tab loses focus**
   - Handling: Cart badge updates work regardless (fetch continues in background)

### Error Scenarios

| Error Condition                          | User Message                                                  | System Behavior                                   |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| CartService unavailable (500)            | "Unable to add to cart. Please try again."                    | Show error toast, retry button, button re-enabled |
| Product not found (404)                  | "This product is no longer available"                         | Disable button, show error                        |
| Invalid quantity (400)                   | "Please select a valid quantity"                              | Focus on quantity input, clear error on change    |
| Session expired                          | "Your session expired. Please refresh and try again."         | Show refresh button, reload page                  |
| Network timeout (> 5s)                   | "Request took too long. Please check connection and retry."   | Show retry button                                 |
| CORS error (blocked by browser)          | "Cannot add to cart at this time. Please try again."          | Log to console; retry button enabled             |
| Cart quota exceeded (too many items)     | "Your cart is full. Remove items to add more."                | Button disabled or show "cart full" message      |
| Malformed response from server           | "Something went wrong. Please try again."                     | Log error, retry button enabled                  |

### Data Validation Rules

- **Quantity**: Must be 1-999, integer, selected from dropdown
- **Product ID**: String, 1-20 chars, alphanumeric + underscore
- **Cart Size**: Must be validated server-side before accepting
- **Response**: Must include `success` (boolean) and `cartSize` (number) fields
- **Session ID**: Valid UUID in shop_session-id cookie

---

## 📦 Dependencies

### Blocking

- [ ] None — Add-to-cart feedback can be developed independently

### Related

- **SCRUM-1** — Wishlist feature (may share toast notification system)
- **SCRUM-2** — Order history (related to cart/checkout flow)
- **SCRUM-CATALOG-FILTERS-001** — Filters may spawn add-to-cart from filtered results

### Infrastructure

- **Frontend Service**: Go gRPC handlers already in place
- **CartService**: C# service working as expected (no changes needed)
- **gorilla/mux**: HTTP router supports POST/JSON responses
- **Go templates**: Already rendering product pages with forms

---

## 🎓 Definition of Done

### Code Quality

- [ ] JavaScript code validates input sanitization (no XSS)
- [ ] No hardcoded values; use configuration for toast timing, retry limits
- [ ] Follows frontend Go handler patterns (error handling, logging)
- [ ] Code is commented for complex logic (e.g., debouncing, retry mechanism)
- [ ] No console errors or warnings in browser dev tools
- [ ] CSS classes follow BEM naming convention

### Testing

- [ ] All 10 BDD scenarios automated (E2E tests with Selenium/Playwright)
- [ ] Unit tests for debouncing logic (JavaScript)
- [ ] Unit tests for error handling (retry, message display)
- [ ] Integration test: add-to-cart updates cart badge correctly
- [ ] Load test: 100 concurrent add-to-cart requests complete successfully with feedback
- [ ] Cross-browser testing: Chrome, Firefox, Safari, Edge (latest versions)
- [ ] Accessibility test: ARIA live regions announced via screen reader (NVDA/JAWS)
- [ ] Mobile testing: iPhone, Android (viewport < 600px)
- [ ] Offline test: Verify graceful degradation (form submit fallback if JS disabled)

### Documentation

- [ ] JavaScript function documentation (JSDoc style)
- [ ] Toast component API documentation (accepted props, events)
- [ ] Error codes documented with recovery steps
- [ ] Updated handler endpoint docs (new JSON response format)
- [ ] Accessibility notes for future maintainers

### Review & Deployment

- [ ] Code reviewed and approved (1+ reviewer)
- [ ] PR merged to main branch
- [ ] All CI checks passing (linting, type checking, tests)
- [ ] No breaking changes to existing cart behavior
- [ ] Feature enabled by default (no feature flag needed)
- [ ] Monitoring: Track add-to-cart latency (backend + frontend) in traces

### Infrastructure

- [ ] Toast animations render smoothly (60fps, GPU-accelerated CSS)
- [ ] JavaScript bundle size increase measured (should be < 15KB gzipped)
- [ ] No new external dependencies introduced
- [ ] No performance regression in page load time

---

## 📝 Implementation Notes

**For Frontend Engineer**:
- Reference `src/frontend/handlers.go` addToCartHandler for current flow (lines 211-237)
- Reference `src/frontend/templates/product.html` for button location (line 69)
- Create `src/frontend/static/js/add-to-cart.js` for AJAX logic
- Create `src/frontend/templates/toast.html` for notification component
- Modify response format from 302 redirect to JSON: `{ "success": true, "cartSize": 2, "message": "Added to cart" }`
- Update header.html to accept dynamic cart badge via data attributes
- Ensure fallback form submission works for non-JavaScript clients
- Test with network throttling (slow 3G) to verify perceived latency < 200ms

**For Backend Engineer**:
- Modify addToCartHandler response type (currently 302 Found, change to 200 OK with JSON body)
- Ensure CartService error responses are properly propagated (no silent failures)
- Add response timing to logs (how long did insertCart take?)
- Verify error codes are consistent (use gRPC error codes where applicable)
- No changes to CartService gRPC contract needed

**For QA Engineer**:
- Test button debouncing (rapid clicks within 100ms should send only 1 request)
- Test error scenarios: kill CartService, simulate network timeout (use browser DevTools throttling)
- Test accessibility: use NVDA (Windows) or VoiceOver (Mac) to verify announcements
- Test on real mobile devices (not just responsive mode)
- Test form fallback: disable JavaScript and verify form submission still works
- Verify cart badge updates across multiple browser tabs (if session is shared)

**Known Gotchas**:
- **CORS headers**: Ensure /cart endpoint accepts fetch requests (check Content-Type header)
- **Session ID extraction**: Ensure fetch request includes session ID in cookie/header
- **DOM updates timing**: Toast might appear before cart badge updates; use Promise chains to order updates
- **Browser caching**: Ensure cache headers allow fresh cart state (no aggressive caching of /cart endpoint)
- **Mobile font size**: Ensure toast text is readable on small screens (test on iPhone SE / Android 6")

---

## 🔗 References

- **Current Handler**: `src/frontend/handlers.go` lines 211-237 (addToCartHandler)
- **Product Template**: `src/frontend/templates/product.html` line 69 (Add To Cart button)
- **Cart Template**: `src/frontend/templates/cart.html` (for reference on cart display)
- **Header Template**: `src/frontend/templates/header.html` (cart badge location)
- **Current Redirect Pattern**: 302 Found to /cart (to be replaced with AJAX + JSON)
- **Accessibility Reference**: WCAG 2.1 Level AA (https://www.w3.org/WAI/WCAG21/quickref/)
- **Toast Component Reference**: https://inclusive-components.design/notifications/ (accessible notifications)

---

**Metadata**:
- **Created**: 2026-04-14
- **Created By**: Claude SDD Generator (from input: "Mejorar feedback visual al agregar productos al carrito")
- **INVEST Validated**: ✅ (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- **BDD Scenarios**: 10 (comprehensive coverage)
- **Priority**: High (improves user experience, foundational for other features)
- **Labels**: `feature`, `sdd`, `frontend`, `ux`, `accessibility`
