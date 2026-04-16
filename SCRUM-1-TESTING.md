# SCRUM-1 Testing Guide - Wishlist Feature

**Ticket**: Add Wishlist Feature to Save Favorite Products  
**Date**: 2026-04-16  
**Status**: Ready for Testing (Phases 5-7)

---

## 📋 Testing Phases Overview

| Phase | Task | Status | Time |
|-------|------|--------|------|
| Phase 5 | Unit Tests | ⏳ Ready | 30min |
| Phase 6 | Integration Tests (Redis) | ⏳ Ready | 45min |
| Phase 7 | E2E Tests (Playwright) | ⏳ Ready | 60min |
| Phase 7+ | Load Testing | ⏳ Ready | 30min |

---

## 🎯 Prerequisites

Before starting tests, ensure you have:

```bash
# 1. Cluster running
kubectl get nodes  # Should show 4 Ready nodes

# 2. Services deployed
kubectl get pods   # All should be Running

# 3. Port-forward active
kubectl port-forward deployment/frontend 8080:8080

# 4. Dependencies installed
cd e2e && npm install
```

---

## Phase 5: Unit Tests

### 5.1 Go Unit Tests for FavoritesService

**Location**: `src/favoritesservice/`

```bash
# Test the FavoritesService
cd ~/qaf/microservices-demo/src/favoritesservice

# Run all Go tests
go test ./...

# Run with verbose output
go test -v ./...

# Run with coverage
go test -v ./... -coverprofile=coverage.out
go tool cover -html=coverage.out  # View coverage in browser
```

**Expected Output:**
```
ok  	github.com/GoogleCloudPlatform/microservices-demo/src/favoritesservice	0.5s
coverage: XX.X% of statements
```

**What it tests:**
- AddFavorite gRPC method
- GetFavorites gRPC method
- RemoveFavorite gRPC method
- ClearFavorites gRPC method
- Error handling
- Idempotent operations

---

### 5.2 Frontend Go Unit Tests

**Location**: `src/frontend/`

```bash
# Test wishlist handlers
cd ~/qaf/microservices-demo/src/frontend

# Run frontend tests
go test ./... -v

# Specifically test wishlist handlers
go test -v -run TestWishlist ./...

# Coverage report
go test -v ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

**What it tests:**
- viewWishlistHandler
- addToWishlistHandler
- removeFromWishlistHandler
- Price conversion logic
- Product enrichment

---

### 5.3 Check Test Coverage

```bash
# View coverage percentage
go tool cover -func=coverage.out | tail -1

# Target: >= 80% coverage
# Example output:
# total:        (statements)    84.2%
```

**Minimum Coverage Goals:**
- FavoritesService: ≥ 85%
- Frontend handlers: ≥ 80%
- Overall: ≥ 82%

---

## Phase 6: Integration Tests (with Redis)

### 6.1 Redis Connection Test

```bash
# Verify Redis is running in cluster
kubectl get svc redis-cart

# Check Redis is accessible
kubectl run -it --rm debug --image=redis:latest --restart=Never -- \
  redis-cli -h redis-cart ping

# Expected: PONG
```

### 6.2 FavoritesService → Redis Integration

```bash
cd ~/qaf/microservices-demo/src/favoritesservice

# Run integration tests (if they exist)
go test -v -tags=integration ./...

# Test with actual Redis backend
# This requires the test to connect to real Redis
```

### 6.3 Frontend → FavoritesService Integration

```bash
cd ~/qaf/microservices-demo/src/frontend

# Test frontend calling FavoritesService
go test -v -run Integration ./...
```

**Integration Test Scenarios:**

1. **Add to Favorites & Retrieve**
   ```bash
   # Curl test
   curl -X POST http://localhost:8080/wishlist/add \
     -d "product_id=OLJCESPC7Z" \
     -d "quantity=1"
   
   # Verify
   curl http://localhost:8080/wishlist
   # Should show the added product
   ```

2. **Remove from Favorites**
   ```bash
   curl -X POST http://localhost:8080/wishlist/remove \
     -d "product_id=OLJCESPC7Z"
   
   # Verify it's removed
   curl http://localhost:8080/wishlist
   ```

3. **Session Isolation**
   ```bash
   # Test from different session (clear cookies)
   curl -b "" http://localhost:8080/wishlist
   # Should show empty wishlist (different user)
   ```

### 6.4 Database Persistence Test

```bash
# 1. Add item to wishlist
curl -X POST http://localhost:8080/wishlist/add \
  -d "product_id=OLJCESPC7Z" \
  -d "quantity=1"

# 2. Check Redis directly
kubectl exec -it $(kubectl get pods -l app=redis-cart -o name | head -1) -- \
  redis-cli KEYS "wishlist*"

# 3. Restart FavoritesService pod
kubectl delete pod $(kubectl get pods -l app=favoritesservice -o name)

# 4. Verify data persists
kubectl wait --for=condition=ready pod -l app=favoritesservice --timeout=60s

# 5. Check wishlist still has the item
curl http://localhost:8080/wishlist
# Should still show the item
```

---

## Phase 7: E2E Tests (Playwright)

### 7.1 Run Full E2E Test Suite

```bash
cd ~/qaf/microservices-demo/e2e

# Run all wishlist tests
npm test -- --grep "Wishlist"

# Run specific scenario
npx playwright test --grep "SC01"  # Empty wishlist
npx playwright test --grep "SC02"  # Correct structure
npx playwright test --grep "SC03"  # Title
# ... etc
```

### 7.2 Interactive Testing

```bash
# Option 1: UI Mode (most visual)
npm run test:ui
# Opens browser-based test runner

# Option 2: Headed Mode (see browser)
npm run test:headed
# Tests run with visible browser

# Option 3: Debug Mode (step through)
npm run test:debug
# Pause at each step, inspect elements
```

### 7.3 Test Results

```bash
# View HTML report
npx playwright show-report

# Or
npm run test:ui
```

**Expected Outcomes:**

| Scenario | Expected Result |
|----------|-----------------|
| SC01: Empty state | ✅ Shows "Your wishlist is empty!" |
| SC02: Structure | ✅ Main element with class "wishlist-sections" |
| SC03: Title | ✅ Page title contains "Online Boutique" |
| SC04: Navigation | ✅ Can navigate from home to wishlist |
| SC05: HTTP 200 | ✅ Response status is 200 OK |
| SC06: Header | ✅ Header element visible |
| SC07: Helper text | ✅ Shows "Items you add..." message |
| SC08: ARIA role | ✅ main[role="main"] element present |
| SC09: No errors | ✅ Page loads without JS errors |
| SC10: Path accessible | ✅ URL contains /wishlist |

---

### 7.4 Cross-Browser Testing

```bash
# Test on specific browser
npx playwright test --project=chromium   # Chrome
npx playwright test --project=firefox    # Firefox
npx playwright test --project=webkit     # Safari

# Test all at once
npm test
```

### 7.5 Mobile Viewport Testing

```bash
# Tests run on 3 viewports:
# - Desktop: 1920x1080
# - Tablet: 768x1024
# - Mobile: 375x667

# Run and view reports
npm test
npx playwright show-report
```

---

## Phase 7+: Load Testing

### 8.1 Concurrent Add to Favorites

**Test**: 10 simultaneous requests to add different products

```bash
# Create load test script
cat > /tmp/load-test.sh << 'EOF'
#!/bin/bash

# Add 10 products concurrently
for i in {1..10}; do
  PRODUCT_ID=$(printf "PRODUCT%03d" $i)
  curl -X POST http://localhost:8080/wishlist/add \
    -d "product_id=$PRODUCT_ID" \
    -d "quantity=1" \
    --silent &
done

wait

# Verify all were added
echo "Checking wishlist..."
curl -s http://localhost:8080/wishlist | grep -c "product" || echo "Could not count products"
EOF

chmod +x /tmp/load-test.sh
/tmp/load-test.sh
```

### 8.2 Stress Test: Multiple Users

**Test**: Simulate 5 different users adding/removing items

```bash
# Create separate sessions (different cookies)
for user in {1..5}; do
  echo "User $user - Adding to favorites..."
  
  curl -b "session_user=$user" \
    -X POST http://localhost:8080/wishlist/add \
    -d "product_id=OLJCESPC7Z" \
    --silent &
    
  sleep 0.5
done

wait

# Verify isolation: each user should have own wishlist
for user in {1..5}; do
  echo "User $user wishlist:"
  curl -b "session_user=$user" http://localhost:8080/wishlist | grep "Sunglasses" && echo "✅ Item found"
done
```

### 8.3 Performance Benchmark

```bash
# Install Apache Bench (if needed)
# macOS:
brew install httpd

# Linux:
sudo apt-get install apache2-utils

# Run load test: 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:8080/wishlist

# Expected output:
# Requests per second: >= 50 req/sec
# Time per request: <= 200ms
# Failed requests: 0
```

**Benchmark Goals:**
- Requests per second: ≥ 50
- Mean time per request: ≤ 200ms
- 95th percentile latency: ≤ 300ms
- 99th percentile latency: ≤ 500ms
- Success rate: 100% (0 failures)

---

### 8.4 Load Test with Apache Bench (Detailed)

```bash
# Test 1: GET /wishlist (read-heavy)
ab -n 1000 -c 50 http://localhost:8080/wishlist

# Test 2: POST /wishlist/add (write-heavy)
ab -n 100 -c 10 -p /tmp/add.txt -T application/x-www-form-urlencoded \
  http://localhost:8080/wishlist/add

# Create POST data file
cat > /tmp/add.txt << EOF
product_id=OLJCESPC7Z&quantity=1
EOF

# Test 3: Mixed (80% read, 20% write)
# Use ApacheBench with custom script or use wrk
```

---

### 8.5 Memory & Resource Monitoring

```bash
# Watch pod resources during load test
kubectl top pods -l app=favoritesservice --watch

# In another terminal, run load test
ab -n 500 -c 50 http://localhost:8080/wishlist

# Expected:
# Memory: < 50Mi
# CPU: < 100m
# No OOMKilled events
```

---

## 📊 Testing Checklist

### Phase 5: Unit Tests
- [ ] FavoritesService unit tests pass (`go test`)
- [ ] Frontend handler tests pass
- [ ] Coverage ≥ 80% overall
- [ ] All test cases documented

### Phase 6: Integration Tests
- [ ] Redis connection works
- [ ] Add favorite persists to Redis
- [ ] Remove favorite removes from Redis
- [ ] Session isolation verified (different users = different lists)
- [ ] Data survives service restart
- [ ] Price conversion works correctly
- [ ] Product enrichment works

### Phase 7: E2E Tests
- [ ] All 10 wishlist scenarios pass
- [ ] Chrome browser: all tests pass
- [ ] Firefox browser: all tests pass
- [ ] Safari browser: all tests pass
- [ ] Mobile viewport (375px): all tests pass
- [ ] Tablet viewport (768px): all tests pass
- [ ] Desktop viewport (1920px): all tests pass
- [ ] No console errors during tests
- [ ] HTML report generated successfully

### Phase 8: Load Testing
- [ ] 100 concurrent requests succeed
- [ ] Response time ≤ 200ms (95th percentile)
- [ ] Zero failed requests
- [ ] Memory usage < 50Mi
- [ ] CPU usage < 100m
- [ ] Different users have isolated wishlists
- [ ] Data persists after load test

---

## 🐛 Troubleshooting

### Tests Won't Connect to http://localhost:8080

```bash
# Verify port-forward is active
kubectl port-forward deployment/frontend 8080:8080 &

# Verify it's actually listening
curl -I http://localhost:8080

# If still failing, restart port-forward
killall kubectl
kubectl port-forward deployment/frontend 8080:8080
```

### Redis Tests Fail

```bash
# Check Redis is running
kubectl get pods -l app=redis-cart

# Check Redis is accessible
kubectl exec -it $(kubectl get pods -l app=redis-cart -o name | head -1) -- \
  redis-cli ping
# Should return: PONG

# Check FavoritesService can reach Redis
kubectl logs deployment/favoritesservice | grep -i redis
```

### Playwright Tests Timeout

```bash
# Increase timeout
npx playwright test --timeout=60000

# Run with debug output
DEBUG=pw:api npx playwright test

# Check browser is launching
npm run test:headed  # See the browser
```

### Load Test Shows High Latency

```bash
# Check pod resources
kubectl top pods

# Check for errors in logs
kubectl logs deployment/favoritesservice -f
kubectl logs deployment/frontend -f

# Reduce concurrency
ab -n 100 -c 10 http://localhost:8080/wishlist  # Instead of -c 50
```

---

## 📈 Success Criteria

✅ **Phase 5**: All unit tests pass, coverage ≥ 80%  
✅ **Phase 6**: Integration tests pass, data persists  
✅ **Phase 7**: All E2E scenarios pass on all browsers  
✅ **Phase 8**: Load test: 50+ req/sec, ≤ 200ms latency  

---

## 📝 Commands Quick Reference

```bash
# Unit Tests
cd src/favoritesservice && go test -v ./...
cd src/frontend && go test -v ./...

# Integration Tests
# (manual curl tests shown above)

# E2E Tests
cd e2e && npm test
npm run test:ui          # Interactive
npm run test:headed      # With browser
npm run test:debug       # Step through

# Load Testing
ab -n 100 -c 10 http://localhost:8080/wishlist

# Monitor
kubectl top pods -l app=favoritesservice --watch
```

---

## 🎯 Next Steps After Testing

1. **If all tests pass**: ✅ Ready for staging deployment
2. **If tests fail**: 🔧 Debug, fix, and re-test
3. **Document results**: Create test report
4. **Create PR**: With test results as evidence
5. **Code review**: Get approval from team
6. **Deploy to production**: Roll out wishlist feature

---

**Ready to start testing?** 🚀

```bash
cd ~/qaf/microservices-demo
# Start with Phase 5
cd src/favoritesservice && go test -v ./...
```
