# Implementation Log — SCRUM-1 (Add Wishlist Feature)

## Summary

**Ticket**: SCRUM-1 — Add Wishlist Feature to Save Favorite Products  
**Implemented by**: Claude Haiku 4.5 (Autonomous) + Claude Sonnet 4.6  
**Branch**: main  
**Key commits**:
- `00eb0245` — feat(SCRUM-1): Complete wishlist feature with Go favoritesservice
- `2c31597a` — feat(SCRUM-1): Implement complete wishlist functionality with AJAX and UI feedback
- `43659273` — test(SCRUM-1): Add comprehensive E2E tests covering all acceptance scenarios

---

## Files Created

### C# FavoritesService (Backend)

| File | Purpose |
|------|---------|
| `src/favoritesservice/FavoritesService.csproj` | .NET 10.0 gRPC service project |
| `src/favoritesservice/Program.cs` | DI container + entry point |
| `src/favoritesservice/Services/FavoritesService.cs` | gRPC service: AddFavorite, GetFavorites, RemoveFavorite, ClearFavorites |
| `src/favoritesservice/Models/Favorite.cs` | Data model: product_id (string) + added_at (timestamp) |
| `src/favoritesservice/Stores/IFavoritesStore.cs` | Pluggable storage interface |
| `src/favoritesservice/Stores/RedisStore.cs` | Redis implementation (atomic read-modify-write, 48h TTL) |
| `src/favoritesservice/Tests/FavoritesServiceTests.cs` | 13 xUnit tests (mocked store) |
| `src/favoritesservice/Tests/FavoritesServiceTests.csproj` | Test project (xUnit + Moq) |

### Go Frontend Handlers

| File | Purpose |
|------|---------|
| `src/frontend/wishlist_handlers.go` | HTTP handlers: viewWishlistHandler, addToWishlistHandler, removeFromWishlistHandler |
| `src/frontend/rpc.go` (modified) | RPC wrappers: getFavorites, addFavorite, removeFavorite |
| `src/frontend/main.go` (modified) | FavoritesService gRPC client init + route registration |

### Templates & Proto

| File | Purpose |
|------|---------|
| `src/frontend/templates/wishlist.html` | Wishlist page: product grid, empty state, add-to-cart, remove buttons |
| `protos/demo.proto` (modified) | FavoritesService + message types added |

---

## Routes Registered

| Method | Path | Handler |
|--------|------|---------|
| GET | `/wishlist` | `viewWishlistHandler` |
| POST | `/wishlist/add` | `addToWishlistHandler` |
| POST | `/wishlist/remove` | `removeFromWishlistHandler` |

---

## Test Results (Phase 5 — 2026-04-16)

| Suite | Framework | Total | Passed | Failed |
|-------|-----------|-------|--------|--------|
| Unit (C#) | xUnit | 13 | 13 | 0 |
| Go packages | go test | 2 pkg | ok | 0 |
| E2E | Playwright | 10 scenarios | committed | — |

**Coverage note**: Unit test coverage is low (2%) because tests mock `IFavoritesStore`. The `RedisStore.cs` implementation requires integration tests with a live Redis instance.

---

## Known Gaps

- Integration tests (Frontend ↔ FavoritesService ↔ Redis) require running services
- E2E tests committed in `43659273` require Playwright + running app
- Kubernetes manifest for `favoritesservice` not created yet
- Helm chart template for `favoritesservice` not created yet
