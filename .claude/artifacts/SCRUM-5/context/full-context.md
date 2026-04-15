# SCRUM-5: Improve Visual Feedback for Add-to-Cart Actions

**Status**: To Do  
**Priority**: High  
**Labels**: accessibility, feature, frontend, sdd, ux  
**Sprint**: SCRUM Sprint 1 (2026-04-14 to 2026-04-28)  
**Created**: 2026-04-14  

## User Story

**As a** customer shopping for products in the Online Boutique store  
**I want** to receive immediate visual confirmation when I add items to my cart  
**So that** I have clear feedback that my action was successful and I can see the updated cart status without navigating away

---

## Success Criteria

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

---

## Key Acceptance Criteria (BDD Scenarios)

### Scenario 1: User sees confirmation after adding product to cart

**Given** I am viewing product "OLJCESPC7Z" (Sunglasses) and my cart has 0 items  
**When** I select quantity "2" and click "Add To Cart"  
**Then** the button shows loading state, success toast appears within 200ms, cart badge updates from "0" to "2"

### Scenario 2: User sees error when cart service is unavailable

**Given** I am viewing a product and CartService is temporarily unavailable  
**When** I click "Add To Cart"  
**Then** I see error message with retry button, cart badge does NOT update

### Scenario 3: Button provides visual feedback during request

**When** I click the "Add To Cart" button  
**Then** the button immediately shows loading indicator, button is disabled, loading persists until response arrives (< 100ms)

### Scenario 4: Rapid button clicks are debounced

**When** I rapidly click "Add To Cart" button 3 times in 100ms  
**Then** only 1 add-to-cart request is sent

### Scenario 5: Screen reader announces cart addition

**When** I use a screen reader and press Enter on "Add To Cart" button  
**Then** screen reader announces "Added 1 item to cart"

---

## Technical Context

### Current State

- **Add-to-Cart Flow**: Form submission (POST /cart) with server-side redirect to /cart page
- **Feedback**: None (silent redirect)
- **Cart Badge**: Static header badge, updates only on page reload
- **Handler**: `addToCartHandler` in `frontend/handlers.go` (lines 211-237)
- **Latency**: ~50-100ms typical

### Proposed Changes

1. Frontend Template Updates - Add loading state CSS classes and spinner icon
2. New Client-Side JavaScript Module (add-to-cart.js) - Intercept form submit, convert to fetch API
3. Backend Response Enhancement - Return JSON response with new cart size instead of 302 redirect
4. Cart Badge Component Update - Make cart badge dynamic with CSS transitions
5. Toast Notification System - Reusable toast component with auto-dismiss timer

### Technical Constraints

- **No Page Navigation** - Stay on current page after add-to-cart
- **AJAX Not Form Submit** - Use fetch API for background request
- **Performance** - Add-to-cart + feedback must complete in < 100ms
- **Accessibility** - WCAG 2.1 AA compliance (ARIA live regions, keyboard navigation)

---

## Definition of Done

### Code Quality
- JavaScript code validates input sanitization (no XSS)
- No hardcoded values; use configuration for toast timing
- Code is commented for complex logic (debouncing, retry mechanism)
- No console errors in browser dev tools

### Testing
- All BDD scenarios automated (E2E tests with Playwright)
- Unit tests for debouncing logic
- Cross-browser testing: Chrome, Firefox, Safari, Edge
- Accessibility test: ARIA live regions via screen reader
- Mobile testing: iPhone, Android (viewport < 600px)

### Review & Deployment
- Code reviewed and approved
- PR merged to main branch
- All CI checks passing
- No breaking changes to existing cart behavior

---

## Implementation Notes

**For Frontend Engineer:**
- Reference `src/frontend/handlers.go` addToCartHandler (lines 211-237)
- Create `src/frontend/static/js/add-to-cart.js` for AJAX logic
- Create `src/frontend/templates/toast.html` for notification component
- Modify response from 302 redirect to JSON: `{ "success": true, "cartSize": 2, "message": "Added to cart" }`

**For QA Engineer:**
- Test button debouncing (rapid clicks within 100ms should send only 1 request)
- Test error scenarios: kill CartService, simulate network timeout
- Test accessibility: use NVDA/VoiceOver to verify announcements
- Test on real mobile devices

---

## References

- **Accessibility**: WCAG 2.1 Level AA (https://www.w3.org/WAI/WCAG21/quickref/)
- **Toast Component**: https://inclusive-components.design/notifications/
