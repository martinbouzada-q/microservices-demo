# SCRUM-1 Implementation Plan: Add Wishlist Feature

## 1. Summary

Implement a session-based wishlist feature that allows users to save favorite products for later review. The feature will include:
- A new C# gRPC `FavoritesService` (parallel to CartService)
- Frontend HTTP handlers and templates for wishlist UI
- Proto definitions for FavoritesService
- Integration with existing session, product catalog, and currency services

**Estimated Effort**: 5-7 days  
**INVEST Validation**: ✅ Meets all criteria (recommend splitting into 2 sub-tickets if > 5 days)

---

## 2. Affected Files

### CREATE (New Files)

#### Backend (C# FavoritesService)
- `src/favoritesservice/` — New directory structure
- `src/favoritesservice/src/services/FavoritesService.cs` — Main gRPC service implementation
- `src/favoritesservice/src/stores/IFavoritesStore.cs` — Interface for pluggable storage backends
- `src/favoritesservice/src/stores/RedisStore.cs` — Redis implementation of IFavoritesStore
- `src/favoritesservice/src/models/Favorite.cs` — Data model (product_id, added_at timestamp)
- `src/favoritesservice/src/main/proto/demo.proto` — Proto definitions for FavoritesService
- `src/favoritesservice/FavoritesService.csproj` — .NET project file
- `src/favoritesservice/Program.cs` — Service entry point
- `src/favoritesservice/tests/FavoritesServiceTests.cs` — Unit tests (80%+ coverage)

#### Frontend (Go)
- `src/frontend/wishlist_handlers.go` — HTTP handlers for wishlist operations
- `src/frontend/templates/wishlist.html` — Template for wishlist page

#### Proto Definitions
- `protos/favoritesservice.proto` — Canonical proto definition (NEW)
- Update `protos/demo.proto` — Add FavoritesService definition

#### Tests & Configuration
- `src/favoritesservice/tests/FavoritesServiceTests.cs` — Unit tests
- `.github/workflows/test-favoritesservice.yml` — CI workflow (if using GitHub Actions)

### UPDATE (Existing Files)

#### Proto Files (Both Definitions)
- `protos/demo.proto` — Add FavoritesService and message definitions
- `src/favoritesservice/src/main/proto/demo.proto` — Replicate per project convention

#### Frontend (Go)
- `src/frontend/handlers.go` — Add handlers for `/wishlist*` routes and request routing
- `src/frontend/main.go` — Initialize FavoritesService gRPC client, environment variables
- `src/frontend/templates/header.html` — Add wishlist link and badge count to header
- `src/frontend/templates/product.html` (or similar) — Add "Add to Wishlist" button
- `src/frontend/templates/browse.html` (or similar) — Add "Add to Wishlist" button on product cards
- `src/frontend/rpc.go` — Add `getFavorites()`, `addFavorite()`, `removeFavorite()` RPC wrappers

#### Backend Setup
- `docker-compose.yml` (if FavoritesService added to local dev) — Add FavoritesService container
- `kubernetes-manifests/favoritesservice.yaml` (NEW or UPDATE) — Deploy FavoritesService
- `helm-chart/values.yaml` — Add FavoritesService configuration
- `helm-chart/templates/favoritesservice.yaml` — Add FavoritesService Helm template

#### Environment & CI
- `.env.example` or documentation — Add `FAVORITES_SERVICE_ADDR` environment variable
- `CLAUDE.md` — Update to document FavoritesService location and patterns

---

## 3. Implementation Steps

### Phase A: Proto Definitions & Service Interface (2 hours)

**Files**: `protos/demo.proto`, `src/favoritesservice/src/main/proto/demo.proto`

1. Define gRPC service in `protos/demo.proto`:
   ```protobuf
   service FavoritesService {
     rpc AddFavorite (AddFavoriteRequest) returns (AddFavoriteResponse);
     rpc GetFavorites (GetFavoritesRequest) returns (GetFavoritesResponse);
     rpc RemoveFavorite (RemoveFavoriteRequest) returns (RemoveFavoriteResponse);
     rpc ClearFavorites (ClearFavoritesRequest) returns (ClearFavoritesResponse);
   }
   ```

2. Define message types:
   - `Favorite { string product_id, string added_at }`
   - `AddFavoriteRequest { string session_id, string product_id }`
   - `GetFavoritesRequest { string session_id }`
   - `GetFavoritesResponse { repeated Favorite favorites }`
   - `RemoveFavoriteRequest { string session_id, string product_id }`
   - `ClearFavoritesRequest { string session_id }`

3. Replicate to `src/favoritesservice/src/main/proto/demo.proto` (project convention)

4. Generate Go stubs for frontend: `protoc --go_out=src/frontend/genproto ...`

---

### Phase B: FavoritesService Backend (C#) (3-4 days)

**Files**: `src/favoritesservice/**`, tests

1. Create C# .NET project structure:
   - `FavoritesService.csproj` with dependencies (gRPC, Protobuf, StackExchange.Redis)
   - `Program.cs` with gRPC server setup

2. Implement storage abstraction:
   - `IFavoritesStore.cs` interface (AddAsync, GetAsync, RemoveAsync, ClearAsync)
   - `RedisStore.cs` — Reuse Redis backend logic from CartService

3. Implement `FavoritesService.cs` gRPC service:
   - `AddFavorite()` — Idempotent add (no duplicates); add timestamp
   - `GetFavorites()` — Return list sorted by added_at descending (newest first)
   - `RemoveFavorite()` — Remove by product ID
   - `ClearFavorites()` — Clear all for session
   - **Race condition prevention**: Use atomic read-modify-write with protobuf serialization

4. Add `Favorite.cs` model:
   ```csharp
   public class Favorite {
       public string ProductId { get; set; }
       public DateTime AddedAt { get; set; }
   }
   ```

5. Implement unit tests (80%+ coverage):
   - Test add/get/remove operations
   - Test idempotency (duplicate adds)
   - Test concurrency (race conditions)
   - Test persistence (data survives restarts)
   - Test empty wishlist
   - Mock storage layer for unit tests

6. Environment variables:
   - `PORT` (default 50052)
   - `REDIS_ADDR` (reuse from cartservice)
   - `ENABLE_TRACING` (log to OTLP collector)

---

### Phase C: Frontend HTTP Handlers (Go) (2-3 days)

**Files**: `src/frontend/wishlist_handlers.go`, `src/frontend/handlers.go`, `src/frontend/rpc.go`

1. Update `src/frontend/main.go`:
   - Initialize `FavoritesServiceClient` using `FAVORITES_SERVICE_ADDR`
   - Log client initialization

2. Create `src/frontend/wishlist_handlers.go`:
   - `viewWishlistHandler(w, r)` — GET `/wishlist`
     - Extract session ID from cookie
     - Call `getFavorites()` RPC
     - Fetch product details from ProductCatalogService (name, image, price)
     - Convert prices using CurrencyService
     - Render `wishlist.html` template
   - `addToWishlistHandler(w, r)` — POST `/wishlist/add`
     - Extract product ID from form data
     - Extract session ID from cookie
     - Call `addFavorite()` RPC
     - Redirect back to referrer (preserve user context)
     - Show confirmation message
   - `removeFromWishlistHandler(w, r)` — POST `/wishlist/remove`
     - Extract product ID from form data
     - Extract session ID from cookie
     - Call `removeFavorite()` RPC
     - Redirect back to referrer
     - Show confirmation message

3. Update `src/frontend/handlers.go`:
   - Add route registrations:
     ```go
     router.HandleFunc("/wishlist", viewWishlistHandler).Methods("GET")
     router.HandleFunc("/wishlist/add", addToWishlistHandler).Methods("POST")
     router.HandleFunc("/wishlist/remove", removeFromWishlistHandler).Methods("POST")
     ```

4. Update `src/frontend/rpc.go`:
   - `getFavorites(sessionID)` — Call FavoritesService.GetFavorites()
   - `addFavorite(sessionID, productID)` — Call FavoritesService.AddFavorite()
   - `removeFavorite(sessionID, productID)` — Call FavoritesService.RemoveFavorite()
   - Add retry logic (up to 3 retries with exponential backoff)
   - Add timeout (5 seconds per RPC call)

---

### Phase D: Frontend Templates & UI (1-2 days)

**Files**: `src/frontend/templates/wishlist.html`, `src/frontend/templates/header.html`, product templates

1. Create `src/frontend/templates/wishlist.html`:
   - Title: "My Wishlist"
   - Empty state: "Your wishlist is empty" with "Continue Shopping" button
   - Product list (if wishlist has items):
     - Product image (thumbnail)
     - Product name (linked to product page)
     - Price in current currency
     - "Add to Cart" button (POST to `/cart/add`)
     - "Remove from Wishlist" button (POST to `/wishlist/remove`)
   - Sort: Most recently added first
   - Pagination: 20 items per page (if 50+ items)

2. Update `src/frontend/templates/header.html`:
   - Add wishlist link to navigation menu
   - Add wishlist count badge (e.g., "Wishlist (3)")
   - Badge updates dynamically via JavaScript on add/remove

3. Update product templates (e.g., `product.html`, `browse.html`):
   - Add "Add to Wishlist" button next to "Add to Cart"
   - Button text toggles: "Add to Wishlist" ↔ "Remove from Wishlist"
   - Show loading state during RPC call
   - Show success/error toast messages

4. Frontend JavaScript (minimal, if SPA interactions needed):
   - AJAX calls for add/remove (optional; can use form POST)
   - Update wishlist badge count
   - Show/hide confirmation toasts

---

### Phase E: Integration & Configuration (1 day)

**Files**: `docker-compose.yml`, `kubernetes-manifests/`, `helm-chart/`, `CLAUDE.md`, `.env.example`

1. Update Docker Compose for local development:
   ```yaml
   favoritesservice:
     build: ./src/favoritesservice
     ports:
       - "50052:50052"
     environment:
       - PORT=50052
       - REDIS_ADDR=redis:6379
       - ENABLE_TRACING=0
   ```

2. Create Kubernetes manifests:
   - `kubernetes-manifests/favoritesservice.yaml` — Deployment, Service, ConfigMap

3. Update Helm chart:
   - `helm-chart/values.yaml` — Add favoritesservice values
   - `helm-chart/templates/favoritesservice.yaml` — Add FavoritesService templates

4. Update `CLAUDE.md`:
   - Add FavoritesService to architecture pattern
   - Document environment variables (`FAVORITES_SERVICE_ADDR`)
   - Update file placement guide with FavoritesService location

5. Update frontend initialization:
   - Pass `FAVORITES_SERVICE_ADDR` to frontend service
   - Ensure gRPC client is initialized before handlers

---

### Phase F: Testing & Validation (2-3 days)

**Files**: Test files, CI configuration

1. **Unit Tests** (C# FavoritesService):
   - Test each RPC method in isolation
   - Mock storage layer
   - Verify idempotency, concurrency, error handling
   - Target: 80%+ code coverage

2. **Integration Tests** (Go Frontend + C# FavoritesService):
   - Full workflow: add → view → remove
   - Multi-product scenarios
   - Session cookie validation
   - Currency conversion on wishlist display
   - Error scenarios (service down, timeout)

3. **E2E Tests** (Playwright or Selenium):
   - User journeys through UI (add, view, remove)
   - Verify wishlist badge updates
   - Verify persistence across page reloads
   - Verify concurrent operations don't lose data

4. **Load Testing** (K6 or Locust):
   - 100 concurrent wishlist operations (add/get/remove)
   - Verify all complete in < 100ms
   - Monitor memory usage (Redis)

5. **Manual Testing**:
   - Test on different screen sizes (mobile, tablet, desktop)
   - Test with different currencies
   - Test session expiry (47h 59m → 48h 1m)
   - Test error scenarios manually

---

## 4. Test Plan (JSON)

```json
{
  "unit": {
    "framework": "xunit",
    "location": "src/favoritesservice/tests/",
    "coverageTarget": 80,
    "testCount": 15,
    "estimatedTime": "5 minutes"
  },
  "integration": {
    "framework": "xunit",
    "location": "src/favoritesservice/tests/",
    "testCount": 8,
    "estimatedTime": "2 minutes"
  },
  "e2e": {
    "framework": "playwright",
    "location": "tests/e2e/",
    "pages": [
      { "url": "/", "actions": ["add product to wishlist"] },
      { "url": "/wishlist", "actions": ["view wishlist", "remove product"] },
      { "url": "/product/OLJCESPC7Z", "actions": ["toggle wishlist button"] }
    ],
    "testCount": 10,
    "estimatedTime": "3 minutes"
  },
  "visualVerification": {
    "required": false
  }
}
```

---

## 5. Environment Requirements

```json
{
  "requiresEnvironmentSetup": true,
  "services": [
    {
      "name": "favoritesservice",
      "type": "gRPC",
      "port": 50052,
      "dependencies": ["redis"]
    }
  ],
  "seedData": {
    "required": false
  },
  "ports": {
    "frontend": { "host": 3000, "container": 8080 },
    "favoritesservice": { "host": 50052, "container": 50052 },
    "redis": { "host": 6379, "container": 6379 }
  }
}
```

---

## 6. Critical Path & Dependencies

```
Phase A: Proto Definitions (2 hours)
    ↓
    ├─→ Phase B: FavoritesService Backend (3-4 days)
    │   ├─→ Phase C: Frontend Handlers (2-3 days)
    │   │   ↓
    │   ├─→ Phase D: Frontend Templates (1-2 days)
    │   ↓
    ├─→ Phase E: Integration & Config (1 day)
    │   ↓
    └─→ Phase F: Testing & Validation (2-3 days)

Total Sequential Time: ~5-7 days
```

**Parallelizable**: Phase B and C can overlap (proto stubs generated in Phase A)

---

## 7. Known Gotchas & Mitigations

| **Gotcha** | **Mitigation** |
| --- | --- |
| **Proto duplication**: Changes to FavoritesService definition must be applied to both `protos/demo.proto` and `src/favoritesservice/src/main/proto/demo.proto` | Create a checklist in PR template; test both proto compilations |
| **Race condition on concurrent adds**: Two simultaneous adds of same product should be idempotent | Use read-modify-write with atomic protobuf serialization; test thoroughly |
| **Session expiry during wishlist view**: Session cookie expires mid-operation | FavoritesService validates session ID; if expired, returns empty list; frontend shows empty state |
| **Currency conversion complexity**: Wishlist items must display in user's current currency | Frontend fetches prices from ProductCatalogService + CurrencyService at display time (not at add time) |
| **Large wishlist performance**: 1000+ items could slow page load | Implement pagination (20 items per page) and lazy loading |

---

## 8. Risk Assessment

| **Risk** | **Probability** | **Impact** | **Mitigation** |
| --- | --- | --- | --- |
| Race condition causes duplicate products | Medium | High | Unit test concurrency thoroughly; use atomic operations |
| FavoritesService outage breaks UI | Low | High | Graceful error handling in frontend; show "unable to load wishlist" vs crashing |
| Proto schema mismatch | Medium | High | Test both proto generations; add schema versioning |
| Session expiry causes data loss | Low | Medium | Session TTL managed by Redis/Spanner; old data cleaned up by TTL |

---

## 9. Success Metrics

- ✅ All 10 BDD scenarios automated and passing
- ✅ Unit test coverage ≥ 80%
- ✅ 100 concurrent wishlist operations complete in < 100ms
- ✅ Zero cross-session data leakage (verified in integration tests)
- ✅ Wishlist page renders correctly on mobile, tablet, desktop
- ✅ Error messages are user-friendly and actionable

---

## 10. Implementation Approach

**Recommended Sequencing**:
1. Start with Phase A (proto) — unblocks both backend and frontend
2. Parallelize Phase B (backend) and Phase C (frontend handlers)
3. Phase D (templates) can begin once Phase C handlers are defined
4. Phase E (integration) happens incrementally as phases complete
5. Phase F (testing) happens throughout; finalize at end

**Estimated Calendar Time**: 5-7 business days (with team parallelization)

---

**Plan Owner**: Implementation Team  
**Plan Version**: 1.0  
**Last Updated**: 2026-04-14
