# SCRUM-5 Deployment & Testing Guide

**Status**: Implementation Complete - Ready for Deployment  
**Date**: 2026-04-15

---

## Quick Deployment (3 Steps)

If your cluster and port-forward are already running:

```bash
# Terminal 1 (if not already running)
cd ~/qaf/microservices-demo
skaffold run

# Terminal 2 (after Skaffold deploys)
kubectl port-forward deployment/frontend 8080:8080

# Terminal 3: Test the changes
cd ~/qaf/microservices-demo/e2e
npm test
```

---

## Full Setup from Scratch

### Prerequisites
- k3d cluster created and running
- kubectl configured
- Docker available
- Node.js 18+ and npm

### Step 1: Delete Old Cluster (if needed)

```bash
k3d cluster delete online-boutique
k3d cluster create online-boutique --agents 3 --servers 1 --wait
kubectl get nodes  # Verify 4 nodes Ready
```

### Step 2: Deploy with Skaffold

```bash
cd ~/qaf/microservices-demo

# Build and deploy all services
skaffold run

# Expected output: "Deployments stabilized in XX seconds"
# Check all pods are ready:
kubectl get pods --watch
# Ctrl+C when all show "Running" and "1/1" Ready
```

### Step 3: Port Forward Frontend

```bash
# In a separate terminal
kubectl port-forward deployment/frontend 8080:8080

# Verify it's accessible:
curl -s http://localhost:8080 | head -20
# Should show HTML content
```

### Step 4: Run Tests

```bash
cd ~/qaf/microservices-demo/e2e

# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Or run specific tests
npx playwright test --grep "SC01"  # Just first scenario

# View results
npm run test:ui              # Interactive UI
npm run test:headed          # See browser
npm run test:debug           # Step through tests
npx playwright show-report   # View HTML report
```

---

## Verifying the Implementation Manually

### Test 1: Verify API Endpoint Exists

```bash
# Check the new endpoint returns JSON
curl -X POST http://localhost:8080/api/cart/add \
  -H "Content-Type: application/json" \
  -d '{"productId":"OLJCESPC7Z","quantity":1}'

# Expected response:
# {"success":true,"cartSize":1,"message":"Added 1 item(s) to cart"}
```

### Test 2: Verify Toast Notifications Load

```bash
# Check add-to-cart.js script is served
curl -s http://localhost:8080/static/js/add-to-cart.js | head -20

# Should show the CartManager class definition
```

### Test 3: Manual Browser Testing

1. Open http://localhost:8080 in your browser
2. Click on a product (e.g., "Sunglasses")
3. **Expected behaviors**:
   - ✅ Button changes to show spinner
   - ✅ Button becomes disabled
   - ✅ Cart badge in header updates
   - ✅ Toast notification appears at top-right
   - ✅ Toast auto-dismisses after ~4 seconds
   - ✅ No page reload/navigation

4. **Test error scenario**:
   - Open browser DevTools (F12)
   - Network tab → Throttle to "Offline"
   - Try to add to cart
   - ✅ Should show error toast
   - ✅ Should show "Retry" button

---

## Troubleshooting

### Issue: Port 8080 already in use

```bash
# Find process using port
lsof -i :8080

# Kill it (macOS)
kill -9 <PID>

# Or use different port
kubectl port-forward deployment/frontend 8081:8080
# Then access http://localhost:8081
```

### Issue: Frontend pod won't start

```bash
# Check pod logs
kubectl logs deployment/frontend -f

# Check pod events
kubectl describe pod $(kubectl get pods -l app=frontend -o name | head -1)

# Common causes:
# - Old image still in Docker: docker system prune
# - BuildKit cache issues: docker buildx prune --all
# - K3d image loading: k3d image import <image> --cluster online-boutique
```

### Issue: Tests timeout or fail to connect

```bash
# Verify frontend is actually running
curl -I http://localhost:8080

# Check port-forward is active
netstat -an | grep 8080  # macOS/Linux
netstat -ano | grep 8080 # Windows

# Restart port-forward if needed
kubectl port-forward deployment/frontend 8080:8080
```

### Issue: JavaScript not working (no spinner/toast)

```bash
# Check browser console for errors (F12 → Console)
# Common causes:
# - JavaScript disabled in browser
# - CORS issues (check Network tab)
# - Add-to-cart.js not loaded: verify in Sources tab

# Check script is being loaded:
curl http://localhost:8080/product/OLJCESPC7Z | grep "add-to-cart.js"
```

---

## Test Coverage

### Automated Tests (E2E with Playwright)

**5 BDD Scenarios**:
- SC01: Success feedback after adding product
- SC02: Error handling when service unavailable
- SC03: Button loading state during request
- SC04: Debouncing rapid clicks
- SC05: Screen reader announcements

**Browsers**: Chrome, Firefox, Safari  
**Viewports**: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667)

**Run tests**:
```bash
cd e2e
npm test

# Run with specific browser
npx playwright test --project=firefox

# Run specific test
npx playwright test --grep "SC01"

# Debug mode (step through)
npx playwright test --debug
```

### Manual Accessibility Testing

```bash
# Screen reader testing (macOS)
# Enable VoiceOver: Cmd+F5
# Navigate with VO+Right Arrow
# Verify announcements when adding to cart

# WAVE browser extension (Chrome)
# https://chromewebstore.google.com/detail/wave-evaluation-tool/jbbplnpobllcpibohnnmldaodajjnkmj
# Scan for accessibility issues (should be 0 errors)

# Axe DevTools (Chrome)
# https://chromewebstore.google.com/detail/axe-devtools-web-accessib/lhdoppojpmngadmnkpklempisson
```

---

## Performance Checklist

After deployment, verify performance:

```bash
# Check add-to-cart latency
curl -s -w "\nTotal time: %{time_total}s\n" \
  -X POST http://localhost:8080/api/cart/add \
  -H "Content-Type: application/json" \
  -d '{"productId":"OLJCESPC7Z","quantity":1}'
# Target: < 100ms

# Lighthouse audit (Chrome)
# Open DevTools (F12) → Lighthouse
# Audit → Performance
# Target: Score > 90

# Check JavaScript bundle size
curl -s http://localhost:8080/static/js/add-to-cart.js | wc -c
# Target: < 10KB
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Connection refused" on localhost:8080 | `kubectl port-forward deployment/frontend 8080:8080` in separate terminal |
| Tests timeout | Ensure `http://localhost:8080` is accessible: `curl http://localhost:8080` |
| Spinner doesn't show | Check browser console (F12) for JavaScript errors |
| Toast doesn't appear | Ensure CSS loaded: `curl http://localhost:8080/static/styles/styles.css` |
| Button still redirects | Clear browser cache (Cmd+Shift+Delete), hard refresh (Cmd+Shift+R) |
| Cart badge doesn't update | Check Network tab (F12) - API call should be 200 OK with `cartSize` in response |

---

## Files Changed Summary

### Backend
- `src/frontend/handlers.go` - New `apiAddToCartHandler` function
- `src/frontend/main.go` - New route `/api/cart/add`

### Frontend
- `src/frontend/static/js/add-to-cart.js` - NEW: AJAX cart module
- `src/frontend/static/styles/styles.css` - Added toast & spinner CSS
- `src/frontend/templates/product.html` - Updated button with loading state
- `src/frontend/templates/header.html` - Updated cart badge with ARIA
- `src/frontend/templates/footer.html` - Added script tag for add-to-cart.js

---

## Next Steps After Deployment

1. **Run E2E Tests**
   ```bash
   cd e2e && npm test
   ```

2. **Capture "After" Screenshots** (for comparison)
   ```bash
   node e2e/capture-after-screenshots.js
   ```

3. **Visual Regression Check**
   ```bash
   # Compare before/after in .claude/artifacts/SCRUM-5/screenshots/
   ```

4. **Accessibility Audit**
   ```bash
   # Use WAVE extension or Axe DevTools
   # Target: 0 violations
   ```

5. **Code Review**
   ```bash
   git diff main..HEAD
   git log --oneline -10
   ```

6. **Commit & Create PR**
   ```bash
   git add .
   git commit -m "feat(SCRUM-5): Add visual feedback for add-to-cart actions"
   gh pr create --title "Improve Visual Feedback for Add-to-Cart Actions"
   ```

---

## Rollback Instructions (if needed)

```bash
# Revert to previous frontend image
kubectl rollout undo deployment/frontend

# Or delete pod to restart with previous image
kubectl delete pod $(kubectl get pods -l app=frontend -o name | head -1)

# Verify
kubectl get pods -l app=frontend
```

---

## Performance Metrics

Expected metrics after deployment:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Add-to-cart latency | < 100ms | `curl` with `-w "%{time_total}s"` |
| Toast display latency | < 200ms | Browser DevTools Network tab |
| Cart badge update | Instant | Visual inspection |
| JavaScript errors | 0 | Browser console (F12) |
| WCAG violations | 0 | WAVE/Axe DevTools |
| Page load time | < 2s | Lighthouse audit |
| Cart completion rate | No decrease | Monitor after deploy |

---

## Success Criteria

✅ All 5 BDD scenarios pass (E2E tests)  
✅ Cross-browser testing (Chrome, Firefox, Safari)  
✅ Mobile responsive (viewport < 600px)  
✅ Accessibility: 0 WCAG violations  
✅ Performance: Add-to-cart < 100ms  
✅ Backward compatible (form fallback works)  
✅ Code reviewed and approved  
✅ Deployed to main branch  

---

## Questions?

If you encounter issues:

1. Check the Troubleshooting section above
2. View pod logs: `kubectl logs deployment/frontend -f`
3. Check browser DevTools (F12) for errors
4. Review implementation files in `src/frontend/`
5. Check E2E test output for specific failures

Good luck! 🚀
