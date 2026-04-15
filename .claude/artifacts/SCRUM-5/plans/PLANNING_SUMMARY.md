# SCRUM-5 Planning Summary

**Generated**: 2026-04-15  
**Status**: ✅ Planning Complete

---

## Quick Overview

**Ticket**: Improve Visual Feedback for Add-to-Cart Actions  
**Type**: User Story (Frontend UX Enhancement)  
**Priority**: High  
**Estimated Effort**: 4-5 development days

---

## What We're Building

### User Experience Change

**Before**: 
- Click "Add to Cart" → Silent form submission → Full page redirect to /cart

**After**:
- Click "Add to Cart" → Button shows spinner → Toast notification appears (200ms) → Cart badge updates live → No page navigation → Toast auto-dismisses

### Key Features

1. **Toast Notifications** - Success and error messages without page nav
2. **Real-time Cart Badge** - Updates instantly as items added
3. **Loading States** - Button shows spinner, gets disabled during request
4. **Error Recovery** - Retry button on failures
5. **Debouncing** - Rapid clicks send only 1 request
6. **Accessibility** - ARIA live regions, screen reader announcements
7. **Mobile Ready** - Works on all screen sizes

---

## Files We Need to Create/Modify

### New Files
```
frontend/static/js/add-to-cart.js (CartManager class)
frontend/static/js/add-to-cart.test.js (Unit tests)
frontend/templates/toast.html (Toast component)
e2e/tests/add-to-cart.spec.ts (E2E tests)
```

### Modified Files
```
frontend/handlers.go (New /api/cart/add endpoint)
frontend/templates/layouts/header.html (Dynamic cart badge)
frontend/templates/product.html (Loading states, data attributes)
frontend/static/css/style.css (Animations, loading spinner)
```

---

## Testing Strategy (6 Levels)

| Level | Framework | Focus | Est. Tests |
|-------|-----------|-------|-----------|
| Unit | Jest | Logic, debouncing, DOM updates | 8-10 |
| Component | Playwright CT | Toast, button states, badge | 4-6 |
| Integration | Jest/Go | Full flow, error scenarios | 5-7 |
| E2E | Playwright | All BDD scenarios, browsers, mobile | 5 + 3 browsers + 3 viewports = 14 |
| Accessibility | Axe + Manual | WCAG 2.1 AA, screen reader | 7 manual checks |
| Visual | Screenshots | No regressions, animations work | 10 states |
| **Total** | | | **~50+ automated tests** |

---

## Test Coverage by Scenario

### ✅ SC1: Confirmation After Adding Product
**Tests**: E2E (Playwright) + Unit (debouncing)
- Button state transitions
- Toast appears within 200ms
- Badge updates from 0 → 2

### ✅ SC2: Error When Service Unavailable
**Tests**: E2E (Playwright with mocked failure)
- Error toast appears
- Badge does NOT update
- Retry button shown

### ✅ SC3: Button Loading Feedback
**Tests**: Unit + E2E
- Button disabled during request
- Spinner visible during loading
- Re-enabled after response

### ✅ SC4: Debounce Rapid Clicks
**Tests**: Unit (CartManager debounce) + E2E (network intercept)
- 3 rapid clicks = 1 request
- Prevents race conditions

### ✅ SC5: Screen Reader Announcement
**Tests**: Accessibility (manual NVDA/VoiceOver)
- ARIA live region announces addition
- Update happens without page reload

---

## Accessibility Compliance

**Target**: WCAG 2.1 Level AA

### Requirements
- ✅ ARIA live regions for toast/cart updates
- ✅ Button has aria-busy during loading
- ✅ Toast has role="status" and aria-live
- ✅ Focus management: Tab navigation works
- ✅ Color contrast: 4.5:1 ratio
- ✅ Keyboard only navigation: No mouse required
- ✅ Screen reader announcements: Clear and concise

### Manual Testing
```bash
# Windows: NVDA (free)
# Mac: Built-in VoiceOver (Cmd+F5)
# Test: Navigate with Tab, add item, verify announcement
```

---

## Performance Targets

| Metric | Target | Why |
|--------|--------|-----|
| Add-to-cart request | < 100ms | User perceives < 200ms as instant |
| Toast display | < 200ms | Perceived latency < 300ms feels slow |
| Cart badge update | Instant | CSS animation makes it smooth |
| JS bundle size | < 10KB | Minimal impact on page load |
| FCP | < 2s | No change from current |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| JS fails silently | High | Fallback: HTML form still works. Error boundaries. |
| XSS in toast | High | Sanitize input. Use `.textContent` not `.innerHTML`. |
| Race conditions | Medium | Debounce (100ms), button lock, request coalescing. |
| Old browser | Medium | Fetch polyfill, progressive enhancement. |
| Network timeout | Low | Show spinner, retry button, acceptable if < 200ms. |

---

## Success Metrics (Post-Deploy)

- ✅ Add-to-cart latency < 100ms (95th percentile)
- ✅ JavaScript error rate < 0.1%
- ✅ Zero WCAG violations
- ✅ Cart abandonment rate: No increase
- ✅ Mobile success rate: > 95% on < 600px viewports

---

## Schedule

| Phase | Days | Task |
|-------|------|------|
| Phase 3 | 0.5 | Environment setup, screenshots |
| Phase 4 | 1.5 | Backend + Frontend code |
| Phase 5 | 1 | Run tests, fix failures |
| Phase 6 | 0.5 | Visual regression, iteration |
| Phase 7 | 0.5 | Docs update |
| Phase 8 | 0.5 | PR creation |
| Phase 9 | 1 | Review + feedback loop |
| **Total** | **5-6 days** | Full SDLC |

---

## Definition of Done

- [ ] All BDD scenarios have E2E test coverage
- [ ] Unit test coverage > 80%
- [ ] Accessibility: 0 WCAG violations
- [ ] Cross-browser: Chrome, Firefox, Safari, Edge passing
- [ ] Mobile: < 600px viewport tested
- [ ] Performance: Add-to-cart < 100ms
- [ ] Code reviewed by 2+ team members
- [ ] CI/CD all green
- [ ] PR merged to main
- [ ] Deployed to staging

---

## Next Steps

**Phase 3**: Environment Setup
- Capture "before" screenshots of current UI
- Set up Playwright test environment (if needed)
- Prepare artifact directories

**Phase 4**: Implementation
- Backend: `/api/cart/add` endpoint, JSON response
- Frontend: JavaScript module, toast component, button states
- Templates: Update header, product page, CSS animations

**Phase 5**: Testing
- Unit tests (Jest)
- E2E tests (Playwright - all BDD scenarios)
- Accessibility tests (Axe-core + manual)
- Performance validation

**Phase 6**: Visual Verification
- Before/after screenshots
- Verify no regressions
- Check animations, responsive layout

**Phase 7-9**: PR & Review
- Create pull request with artifacts
- Code review and feedback
- Deploy to staging

---

## Resources & References

- **WCAG 2.1 AA**: https://www.w3.org/WAI/WCAG21/quickref/
- **Toast Component Pattern**: https://inclusive-components.design/notifications/
- **Playwright Docs**: https://playwright.dev/
- **Jest Testing Guide**: https://jestjs.io/docs/getting-started
- **Axe-core Accessibility**: https://github.com/dequelabs/axe-core
