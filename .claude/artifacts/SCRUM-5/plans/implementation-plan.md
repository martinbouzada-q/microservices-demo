# SCRUM-5 Implementation Plan
## Improve Visual Feedback for Add-to-Cart Actions

**Date**: 2026-04-15  
**Status**: Planning  
**Epic**: Frontend UX Improvements  

---

## 1. Executive Summary

SCRUM-5 requires enhancing the add-to-cart user experience with immediate visual feedback, real-time cart badge updates, error handling, and accessibility support. The implementation converts the current synchronous form-based flow to an asynchronous AJAX-based approach with optimistic UI updates.

**Key Changes**:
- Frontend: New JavaScript module for AJAX cart operations + toast notification system
- Backend: Response type change from 302 redirect to JSON
- Templates: Update cart badge to be dynamic, add loading states
- Testing: Full E2E coverage with Playwright + unit tests for debouncing

**Effort Estimate**: 4-5 days of development + testing  
**Risk Level**: Medium (changes core user flow, requires backward compatibility testing)

---

## 2. Architectural Changes

### 2.1 Current Flow
```
User clicks "Add to Cart" (HTML form)
    ↓
POST /cart (form submit)
    ↓
Server processes, redirects 302
    ↓
Browser navigates to /cart page
    ↓
Page reloads (feedback: new page view)
```

### 2.2 Proposed Flow
```
User clicks "Add to Cart" (intercepted by JS)
    ↓
Button shows loading state
    ↓
Fetch API POST /api/cart/add (JSON)
    ↓
Server processes, returns JSON { cartSize, message }
    ↓
Toast notification appears (200ms)
    ↓
Cart badge updates in real-time
    ↓
Toast auto-dismisses after 3-5s
    ↓
Page stays on product page (no navigation)
```

### 2.3 Component Diagram
```
┌─────────────────────────────────────────┐
│        Frontend (Go templates)          │
├─────────────────────────────────────────┤
│  • home.html                            │
│  • product.html (modified)              │
│  • cart.html                            │
│  • layouts/header.html (cart badge)     │
│  • toast.html (NEW)                     │
└────────┬──────────────────────────────┬─┘
         │                              │
         │ Static Assets               │ HTTP Handlers
         ↓                              ↓
┌──────────────────────┐  ┌───────────────────────────┐
│ add-to-cart.js (NEW) │  │ frontend/handlers.go      │
├──────────────────────┤  ├───────────────────────────┤
│ • Intercept submit   │  │ • addToCartHandler (mod)  │
│ • Fetch API call     │  │ • Response: JSON vs 302   │
│ • Debounce (100ms)   │  │ • Return cartSize         │
│ • Show toast         │  │ • Error handling          │
│ • Update badge       │  │                           │
└──────────────────────┘  └────────┬──────────────────┘
         │                          │
         │ Fetch /api/cart/add      │
         │ (new endpoint)           │
         └──────────────┬───────────┘
                        ↓
         ┌──────────────────────────┐
         │   CartService (gRPC)     │
         │   (unchanged)            │
         └──────────────────────────┘
```

---

## 3. Implementation Tasks

### Phase 3a: Backend Changes
**Timeline**: Day 1  
**Files Modified**: `frontend/handlers.go`

#### 3a.1 Create new API endpoint: `POST /api/cart/add`
```go
// New endpoint that returns JSON instead of 302 redirect
// Route: POST /api/cart/add
// Request: { productId: string, quantity: int }
// Response: { success: bool, cartSize: int, message: string }
// Error Response: { success: false, error: string, retryable: bool }
```

#### 3a.2 Modify `addToCartHandler`
- Keep existing form-based POST /cart for backward compatibility
- Add content-type detection: if Accept=application/json, return JSON
- Add error handling for CartService failures
- Validate input: quantity > 0, productId exists

#### 3a.3 Add Cart Size Retrieval
- Implement `getCartSize()` helper that calls CartService
- Cache result with TTL to avoid repeated service calls

### Phase 3b: Frontend HTML/CSS Changes
**Timeline**: Day 2  
**Files Modified**: `frontend/templates/layouts/header.html`, `frontend/templates/product.html`

#### 3b.1 Make Cart Badge Dynamic
```html
<!-- Before -->
<span class="cart-badge">3</span>

<!-- After -->
<span class="cart-badge" id="cart-count" aria-live="polite" aria-label="Items in cart">3</span>
```

#### 3b.2 Add Loading State to Add-to-Cart Button
```html
<!-- Add classes for loading state -->
<button class="add-to-cart-btn" 
        data-product-id="{{.ProductID}}" 
        aria-busy="false">
  <span class="btn-text">Add to Cart</span>
  <span class="btn-spinner" style="display: none;">
    <i class="spinner-icon"></i>
  </span>
</button>
```

#### 3b.3 Create Toast Component Template (`toast.html`)
```html
<div id="toast-container" aria-live="polite" aria-atomic="true" role="status">
  <!-- Toasts injected here by JS -->
</div>

<style>
#toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  max-width: 400px;
}

.toast {
  padding: 16px;
  margin-bottom: 10px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: slideIn 0.3s ease-out;
}

.toast.success {
  border-left: 4px solid #10b981;
}

.toast.error {
  border-left: 4px solid #ef4444;
}

@keyframes slideIn {
  from { transform: translateX(400px); }
  to { transform: translateX(0); }
}
</style>
```

### Phase 3c: Frontend JavaScript Module
**Timeline**: Day 2-3  
**Files Created**: `frontend/static/js/add-to-cart.js`

#### 3c.1 AJAX Cart Module
```javascript
class CartManager {
  constructor() {
    this.debounceTimer = null;
    this.debounceDelay = 100; // ms
    this.isLoading = false;
  }

  // Intercept form submit events
  async handleAddToCart(event) {
    event.preventDefault();
    
    // Debounce rapid clicks
    if (this.isLoading) return;
    
    const productId = event.target.dataset.productId;
    const quantity = parseInt(event.target.quantity?.value || 1);
    
    await this.addToCart(productId, quantity);
  }

  // Main add-to-cart logic
  async addToCart(productId, quantity) {
    const button = document.querySelector(`[data-product-id="${productId}"]`);
    
    try {
      this.setButtonLoading(button, true);
      
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity })
      });

      const data = await response.json();

      if (response.ok) {
        this.updateCartBadge(data.cartSize);
        this.showToast('success', data.message);
      } else {
        this.showToast('error', data.error);
        if (data.retryable) {
          this.addRetryButton();
        }
      }
    } catch (error) {
      this.showToast('error', 'Network error. Please try again.');
      console.error('Add to cart failed:', error);
    } finally {
      this.setButtonLoading(button, false);
    }
  }

  // Update cart badge in header
  updateCartBadge(count) {
    const badge = document.getElementById('cart-count');
    if (badge) {
      badge.textContent = count;
      // Optional: Add animation
      badge.classList.add('updated');
      setTimeout(() => badge.classList.remove('updated'), 300);
    }
  }

  // Show toast notification with auto-dismiss
  showToast(type, message, duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'assertive');
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  // Set button loading state
  setButtonLoading(button, isLoading) {
    this.isLoading = isLoading;
    if (isLoading) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.querySelector('.btn-spinner').style.display = 'inline';
      button.querySelector('.btn-text').style.display = 'none';
    } else {
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      button.querySelector('.btn-spinner').style.display = 'none';
      button.querySelector('.btn-text').style.display = 'inline';
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const cart = new CartManager();
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => cart.handleAddToCart(e));
  });
});
```

### Phase 3d: CSS Enhancements
**Timeline**: Day 1  
**Files Modified**: `frontend/static/css/style.css`

```css
/* Loading spinner */
.btn-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Button disabled state */
button[aria-busy="true"] {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Cart badge animation */
#cart-count.updated {
  animation: badgeBounce 0.3s ease;
}

@keyframes badgeBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
```

---

## 4. Testing Strategy

### 4.1 Unit Tests

**File**: `frontend/static/js/add-to-cart.test.js`  
**Framework**: Jest

```javascript
describe('CartManager', () => {
  describe('Debouncing', () => {
    test('should not send multiple requests within 100ms', async () => {
      // Mock fetch
      // Rapid click 3 times
      // Assert only 1 request sent
    });
  });

  describe('updateCartBadge', () => {
    test('should update cart count in DOM', () => {
      // Create DOM element
      // Call updateCartBadge(5)
      // Assert badge text is "5"
    });
  });

  describe('Error Handling', () => {
    test('should show error toast on network failure', async () => {
      // Mock fetch to throw error
      // Call addToCart()
      // Assert error toast appears
    });
  });
});
```

### 4.2 Integration Tests

**File**: `e2e/tests/add-to-cart.spec.ts`  
**Framework**: Playwright

```typescript
test.describe('Add-to-Cart Features', () => {
  
  test('SC1: User sees confirmation after adding product to cart', async ({ page }) => {
    // Navigate to product page
    // Set quantity to 2
    // Click "Add to Cart"
    // Assert: button shows loading, toast appears, badge updates to 2
  });

  test('SC2: Error when CartService unavailable', async ({ page }) => {
    // Mock CartService to fail
    // Click "Add to Cart"
    // Assert: error toast appears, badge doesn't change, retry button shown
  });

  test('SC3: Button loading state during request', async ({ page }) => {
    // Click button
    // Assert: button disabled, spinner visible
    // Wait for response
    // Assert: button enabled again
  });

  test('SC4: Debouncing rapid clicks', async ({ page }) => {
    // Intercept network requests
    // Rapidly click button 3 times
    // Assert: only 1 request sent
  });

  test('SC5: Screen reader announces cart addition', async ({ page }) => {
    // Assert aria-live region exists
    // Add item to cart
    // Assert announcement in accessibility tree
  });

  test('Cross-browser: Works on Chrome, Firefox, Safari', () => {
    // Run above tests on all browser engines
  });

  test('Mobile: Works on viewport < 600px', async ({ page }) => {
    // Set viewport to 375x667 (iPhone)
    // Test all cart functionality
  });
});
```

### 4.3 Accessibility Testing

**Manual Steps**:
1. Use NVDA (Windows) or VoiceOver (Mac) screen reader
2. Navigate to product page with keyboard only (Tab, Enter)
3. Add item to cart
4. Verify screen reader announces: "Added 1 item to cart"
5. Verify ARIA live region updates in real-time

**Automated**: Playwright with `@axe-core/playwright`
```javascript
const AxeBuilder = require('@axe-core/playwright').default;

test('Accessibility: No violations after add-to-cart', async ({ page }) => {
  await page.goto('/product/OLJCESPC7Z');
  
  // Add to cart
  await page.click('.add-to-cart-btn');
  await page.waitForTimeout(500);
  
  // Scan for violations
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

### 4.4 Performance Testing

**Lighthouse Audit**:
```bash
lighthouse http://localhost:8080/product/OLJCESPC7Z --view
```

**Requirements**:
- First Contentful Paint (FCP): < 2s
- Largest Contentful Paint (LCP): < 2.5s
- Add-to-cart latency: < 100ms
- JavaScript bundle size: No increase > 10KB

---

## 5. File Changes Summary

| File | Type | Changes |
|------|------|---------|
| `frontend/handlers.go` | Modified | New `/api/cart/add` endpoint, JSON response |
| `frontend/templates/layouts/header.html` | Modified | Cart badge with `aria-live`, dynamic ID |
| `frontend/templates/product.html` | Modified | Button with data attributes, loading spinner |
| `frontend/templates/toast.html` | Created | Toast notification component |
| `frontend/static/js/add-to-cart.js` | Created | AJAX cart module (CartManager class) |
| `frontend/static/css/style.css` | Modified | Loading spinner, animations, disabled states |
| `frontend/static/js/add-to-cart.test.js` | Created | Unit tests for CartManager |
| `e2e/tests/add-to-cart.spec.ts` | Created | E2E tests for all BDD scenarios |

---

## 6. Risk Assessment & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking change: Silent failures if JS fails | High | Fallback: Form submission still works. Add error boundaries. Serve CSS inline to prevent FOUC. |
| XSS vulnerability in toast messages | High | Sanitize all user input. Use `.textContent` not `.innerHTML`. Use template literals safely. |
| Browser compatibility (old browsers) | Medium | Test on IE11 (if required). Use fetch polyfill. Progressive enhancement: forms work without JS. |
| Race conditions on rapid clicks | Medium | Implement debouncing (100ms). Lock button state during request. |
| Network timeout > 100ms | Low | Show spinner during request. Acceptable if < 200ms. Retry button for failures. |

---

## 7. Testing Strategy (Detailed)

### 7.1 Test Levels

**Level 1: Unit Tests**
- CartManager class methods
- Debounce logic
- DOM updates
- Error handling
- Focus: Logic correctness, edge cases

**Level 2: Component Tests** (Playwright Test Components)
- Toast component rendering
- Button state transitions
- Cart badge updates
- Focus: Component behavior in isolation

**Level 3: Integration Tests**
- Full user flow: Product page → Add to cart → Toast → Badge update
- Cross-component interaction: Button → Fetch → CartService → Badge
- Error scenarios: Service failures, network timeouts
- Focus: Components working together

**Level 4: E2E Tests**
- Real browser, real server, real network
- All BDD scenarios from Jira
- Cross-browser (Chrome, Firefox, Safari)
- Mobile responsive (375px viewport)
- Focus: User-facing behavior, no regressions

**Level 5: Accessibility Tests**
- ARIA attributes present and correct
- Screen reader announcements
- Keyboard navigation working
- Focus management correct
- Focus: WCAG 2.1 AA compliance

**Level 6: Visual Regression Tests**
- Screenshot before/after for button, toast, badge
- Verify no visual breakage
- Check spinner animation, toast positioning
- Focus: UI consistency, no visual regressions

---

## 8. Deployment Plan

### 8.1 Pre-Deployment Checklist

- [ ] All tests passing (unit, integration, E2E, accessibility)
- [ ] Code reviewed and approved
- [ ] No console errors in dev tools
- [ ] Load tested: add-to-cart < 100ms latency
- [ ] Accessibility audit passed (0 violations)
- [ ] Screenshots captured (before/after)
- [ ] Mobile testing completed (iOS + Android)
- [ ] Cross-browser tested (Chrome, Firefox, Safari, Edge)

### 8.2 Deployment Strategy

1. **Feature Flag** (optional): Roll out to 10% → 50% → 100%
2. **Backward Compatibility**: Old form-based flow still works
3. **Rollback Plan**: Revert JavaScript file, keep backend changes
4. **Monitoring**: Track error rates, JavaScript errors, cart completion rate

---

## 9. Success Metrics

**Post-Deployment KPIs**:
- Add-to-cart latency: < 100ms (95th percentile)
- JavaScript error rate: < 0.1%
- Cart abandonment rate: No increase
- User satisfaction: +15% in feedback surveys
- Accessibility: 0 WCAG violations
- Mobile usability: 90%+ successful adds on <600px viewports

---

## 10. Schedule & Milestones

| Day | Task | Owner | Status |
|-----|------|-------|--------|
| Day 1 | Backend endpoint + error handling | Backend Dev | ⏳ |
| Day 2 | Frontend templates + CSS | Frontend Dev | ⏳ |
| Day 2-3 | JavaScript module + unit tests | Frontend Dev | ⏳ |
| Day 3 | E2E tests + accessibility tests | QA Dev | ⏳ |
| Day 4 | Visual regression tests + load testing | QA Dev | ⏳ |
| Day 5 | Code review + final testing | All | ⏳ |
| Day 5+ | Deploy to staging → production | DevOps | ⏳ |

---

## 11. Definition of Done

- ✅ All BDD scenarios have E2E test coverage
- ✅ Unit test coverage: > 80%
- ✅ Accessibility: WCAG 2.1 AA, 0 violations
- ✅ Cross-browser: Chrome, Firefox, Safari, Edge
- ✅ Mobile: Tested on viewport < 600px
- ✅ Performance: Add-to-cart < 100ms latency
- ✅ Code reviewed by 2+ team members
- ✅ CI/CD all green (lint, test, build)
- ✅ PR merged to main
- ✅ Deployed to staging for user acceptance testing
- ✅ Production deployment approved
