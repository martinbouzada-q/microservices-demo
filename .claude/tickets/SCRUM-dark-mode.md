---
title: Add system-aware dark mode support across the entire frontend application
type: Story
priority: Medium
estimated-points: 5
---

# SDD Ticket: Add Dark Mode to Frontend Application

## Summary
Implement a system-aware dark mode feature that automatically detects user's OS theme preference and applies a dark color scheme across the entire frontend application.

## Description

Enable dark mode support across the Online Boutique frontend by:
- Auto-detecting the user's operating system dark mode preference using `prefers-color-scheme: dark`
- Allowing users to manually toggle between light and dark modes
- Persisting theme preference across browser sessions
- Maintaining WCAG AA contrast ratios in both themes
- Adjusting platform detection colors for dark mode visibility

### Implementation Scope
- **Affected Component:** Frontend service (`/src/frontend`)
- **Tech Stack:** Go HTTP Server, Go Templates, Plain CSS
- **No new dependencies required**
- **Vanilla JavaScript only (no frameworks)**

---

## Acceptance Criteria

1. ✅ System automatically detects user's `prefers-color-scheme` preference and applies dark mode on first visit
2. ✅ User can toggle between light and dark modes via a button in the header
3. ✅ Theme preference persists across browser sessions (stored in HTTP cookie)
4. ✅ All UI pages render correctly in both light and dark modes
5. ✅ Dark mode colors meet WCAG AA contrast ratio requirements (≥4.5:1 for text)
6. ✅ Platform detection left border colors are adjusted for visibility in dark mode
7. ✅ All four CSS files have been converted to use CSS variables (styles.css, cart.css, order.css, bot.css)
8. ✅ Theme toggle persists correctly and system preference is respected on first visit
9. ✅ No JavaScript framework dependencies (vanilla JS only)
10. ✅ Page load performance is not degraded by dark mode implementation

---

## BDD Scenarios

### Scenario 1: First-time visitor with system dark mode preference
```gherkin
Given a new user visits the application
And their operating system is set to dark mode
And they have not previously set a theme preference
When the page loads
Then the application should render in dark mode automatically
And a theme toggle button should be visible in the header
```

### Scenario 2: User toggles to light mode from dark mode
```gherkin
Given the application is currently displaying in dark mode
And the user sees the theme toggle button in the header
When the user clicks the theme toggle button
Then the application should switch to light mode
And the theme preference should be saved to a cookie
And the light mode preference should persist on page reload
```

### Scenario 3: User toggles to dark mode from light mode
```gherkin
Given the application is currently displaying in light mode
And the user sees the theme toggle button in the header
When the user clicks the theme toggle button
Then the application should switch to dark mode
And all colors should meet WCAG AA contrast requirements
And the theme preference should be saved to a cookie
And the dark mode preference should persist on page reload
```

### Scenario 4: Returning visitor with saved preference
```gherkin
Given a user previously set their theme preference to dark mode
And the preference is stored in an HTTP cookie
When the user returns to the application
Then the application should load in dark mode
And the system preference should be ignored in favor of saved preference
```

### Scenario 5: Platform detection border colors in dark mode
```gherkin
Given the application is running in dark mode
And the deployment platform is GCP (blue border)
When the page header renders
Then the platform detection left border should be visible
And the color should be adjusted for dark backgrounds (less bright)
And the contrast should meet WCAG AA standards
```

### Scenario 6: All pages render correctly in dark mode
```gherkin
Given the user is in dark mode
When the user navigates through these pages:
  | Page          | Status   |
  | Home          | Renders  |
  | Product       | Renders  |
  | Cart          | Renders  |
  | Order History | Renders  |
  | Chat          | Renders  |
Then all text should be readable
And all buttons should be clickable
And all forms should be usable
And no hardcoded light colors should be visible
```

### Scenario 7: CSS variables are used consistently
```gherkin
Given the CSS files have been refactored to use variables
When a developer searches for hardcoded color values (e.g., #853B5C, #CE0631)
Then no hardcoded colors should be found in active CSS
And all colors should reference CSS variables instead
And color changes should be updateable in one location per theme
```

---

## Technical Specifications

### Color Palettes

**Light Mode (Current):**
```css
--color-bg-primary: #FFFFFF
--color-bg-secondary: #F9F9F9
--color-text-primary: #111111
--color-text-secondary: #605f64
--color-brand-primary: #853B5C
--color-brand-secondary: #CE0631
--color-brand-footer: #570D2E
--color-border: #acacac
--color-input-bg: #f2f2f2
--color-form-label: #5C6063
--color-link: #CE0631
--color-link-hover: #7b031d
```

**Dark Mode (New):**
```css
--color-bg-primary: #121212
--color-bg-secondary: #1a1a1a
--color-text-primary: #f0f0f0
--color-text-secondary: #b0b0b0
--color-brand-primary: #b87d99
--color-brand-secondary: #ff6b7a
--color-brand-footer: #2d1a39
--color-border: #404040
--color-input-bg: #252525
--color-form-label: #c0bfbb
--color-link: #ff6b7a
--color-link-hover: #ff8591
```

**Platform Border Colors (Dark Mode Adjusted):**
```css
--platform-aws-dark: #ffb84d      /* Less bright orange */
--platform-gcp-dark: #81a8f5      /* Lighter blue */
--platform-azure-dark: #ff8357    /* Lighter red */
--platform-alibaba-dark: #ffd633  /* Less bright yellow */
--platform-onprem-dark: #5ac055   /* Lighter green */
--platform-local-dark: #6b4ab8    /* Lighter purple */
```

### Architecture Pattern

**Preference Storage:**
- Cookie name: `shop_theme`
- Values: `light` | `dark`
- Duration: 1 year

**Detection Priority:**
1. Check for saved cookie preference
2. If no cookie, check system preference via `prefers-color-scheme: dark`
3. Default to light mode if system preference unavailable

**CSS Architecture:**
- Define all CSS variables at `:root` level
- Use `@media (prefers-color-scheme: dark)` for auto-detection
- Apply `.dark-mode` class to `<html>` tag when explicitly set
- All color values use variables, no hardcoded hex/rgb values

### Files to Modify

**Backend (Go):**
- `/src/frontend/handlers.go` - Add theme handlers
- `/src/frontend/main.go` - Register theme endpoint (if needed)

**Templates:**
- `/src/frontend/templates/header.html` - Add theme toggle button

**Styling:**
- `/src/frontend/static/styles/styles.css`
- `/src/frontend/static/styles/cart.css`
- `/src/frontend/static/styles/order.css`
- `/src/frontend/static/styles/bot.css`

### Go Implementation Pattern

Follow existing patterns from currency selector:

```go
// Handler to set theme preference
func (fe *frontendServer) setTheme(w http.ResponseWriter, r *http.Request) {
    theme := r.FormValue("theme")  // "light" or "dark"
    
    if theme != "light" && theme != "dark" {
        http.Error(w, "Invalid theme", http.StatusBadRequest)
        return
    }
    
    http.SetCookie(w, &http.Cookie{
        Name:   "shop_theme",
        Value:  theme,
        MaxAge: 31536000, // 1 year
    })
    
    http.Redirect(w, r, r.Header.Get("Referer"), http.StatusSeeOther)
}

// Helper to get current theme preference
func getTheme(r *http.Request) string {
    cookie, err := r.Cookie("shop_theme")
    if err == nil && (cookie.Value == "light" || cookie.Value == "dark") {
        return cookie.Value
    }
    return "light" // default
}
```

Update `injectCommonTemplateData()` to include:
```go
"theme": getTheme(r),
```

### Template Implementation

In `header.html`, add theme toggle button:
```html
<button id="theme-toggle" class="theme-toggle" onclick="toggleTheme()" title="Toggle dark mode">
    <span id="theme-icon">🌙</span>
</button>
```

Add inline script before closing `</body>`:
```html
<script>
(function() {
    // Apply saved theme or system preference before page renders
    const savedTheme = getCookie('shop_theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemDark ? 'dark' : 'light');
    
    if (theme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        document.getElementById('theme-icon').textContent = '☀️';
    }
})();

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    const theme = isDark ? 'dark' : 'light';
    document.getElementById('theme-icon').textContent = isDark ? '☀️' : '🌙';
    
    // Save preference via POST
    fetch('{{ $.baseUrl }}/setTheme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'theme=' + theme
    });
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}
</script>
```

---

## INVEST Validation

| Criterion | Status | Notes |
|-----------|--------|-------|
| **Independent** | ✅ | Can be developed independently without blocking features |
| **Negotiable** | ✅ | Implementation approach has flexibility in color choices |
| **Valuable** | ✅ | Improves UX for users preferring dark mode, reduces eye strain |
| **Estimable** | ✅ | Well-defined with clear technical requirements |
| **Small** | ✅ | Estimated 3-4 days (acceptable single story) |
| **Testable** | ✅ | Visual testing + automated theme persistence verification |

### Size Breakdown
- CSS variable refactoring: ~1.5 days
- Go backend handlers: ~0.5 days
- Template updates + toggle UI: ~0.5 days
- Cross-page testing & QA: ~1 day
- **Total: 3.5 days**

---

## Definition of Done

- [ ] All CSS files converted to use CSS variables
- [ ] Theme toggle button functional and visible in header
- [ ] Theme preference persists in cookie across sessions
- [ ] Auto-detection of system preference works (`prefers-color-scheme`)
- [ ] All pages tested in both light and dark modes (Home, Product, Cart, Order History, Chat)
- [ ] Dark mode colors pass WCAG AA contrast checks (verified with automated tool)
- [ ] Platform border colors adjusted for dark mode visibility
- [ ] No console errors in browser DevTools
- [ ] Page load performance metrics: no regression vs light mode
- [ ] Code reviewed and merged to main branch
- [ ] Visual QA sign-off from design/product team

---

## Testing Strategy

### Manual Testing Checklist
- [ ] Set OS to dark mode and verify auto-detection on fresh page load
- [ ] Click theme toggle button and verify switch to light mode
- [ ] Reload page and verify light mode preference persists
- [ ] Click theme toggle again and verify switch to dark mode
- [ ] Reload page and verify dark mode preference persists
- [ ] Test on all pages: Home, Product detail, Cart, Order history, Chat
- [ ] Test on mobile viewport (375px width)
- [ ] Verify platform border colors visible in dark mode
- [ ] Test browser DevTools contrast checker on dark mode colors

### Automated Testing (if applicable)
- [ ] Theme toggle button exists and is clickable
- [ ] Cookie is set correctly after theme toggle
- [ ] Class `dark-mode` is applied to `<html>` when dark theme active
- [ ] No hardcoded color values in CSS (lint check)

---

## Performance Considerations

- Inline theme detection script prevents flash of wrong color scheme
- CSS variables have same performance as hardcoded values
- No additional JavaScript libraries required
- Single additional cookie has negligible performance impact
- Lazy-load theme preference in Go handler (minimal overhead)

---

## Notes

- This implementation maintains backward compatibility (defaults to light mode)
- Can be extended to support additional color schemes in the future
- Color palette defined for easy iteration and A/B testing
- No changes needed to backend services (microservices remain unchanged)

---

## Related Documentation

- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [WCAG: Color Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Google Fonts: DM Sans (current font)](https://fonts.google.com/specimen/DM+Sans)

---

**Created:** 2026-04-14
**Status:** Ready for Implementation
**Estimated Story Points:** 5
