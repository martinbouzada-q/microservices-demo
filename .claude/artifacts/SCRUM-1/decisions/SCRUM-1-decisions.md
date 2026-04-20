# Architectural Decision Records — SCRUM-1 (Wishlist Feature)

## ADR-001: Separate FavoritesService (C# gRPC microservice)

**Status**: Accepted  
**Date**: 2026-04-14

**Decision**: Create a dedicated `FavoritesService` (C#/.NET 10.0) instead of extending CartService.

**Rationale**:
- Allows independent scaling and deployment of wishlist logic
- Follows existing microservices pattern (CartService reference)
- Enables future enhancements (notifications, sharing) without touching cart

**Tradeoffs**: Additional service to deploy and monitor.

---

## ADR-002: Reuse IFavoritesStore pattern (not ICartStore)

**Status**: Accepted  
**Date**: 2026-04-14

**Decision**: Created a separate `IFavoritesStore` interface with a `RedisStore` implementation, rather than reusing `ICartStore` directly.

**Rationale**:
- Wishlist data model differs from cart (no quantity field, has `added_at` timestamp)
- Avoids coupling two independent domains through a shared interface
- Redis TTL reused (48h) — consistent with session cookie expiry

---

## ADR-003: Session-based identity (no user accounts)

**Status**: Accepted  
**Date**: 2026-04-14

**Decision**: Wishlist is tied to `shop_session-id` cookie (UUID, 48h TTL), not a user account.

**Rationale**: Consistent with existing cart/checkout model. No auth exists in the system. Wishlist is ephemeral by design.

**Tradeoffs**: Wishlist lost on session expiry. Acceptable for MVP.

---

## ADR-004: Go favoritesservice client embedded in frontend

**Status**: Accepted  
**Date**: 2026-04-14

**Decision**: The Go frontend service holds the gRPC client to FavoritesService. No separate BFF layer.

**Rationale**: Consistent with how CartService, ProductCatalogService, etc. are called from the frontend. All gRPC clients are initialized in `main.go`.

---

## ADR-005: No quantity field in Favorite

**Status**: Accepted  
**Date**: 2026-04-14

**Decision**: `Favorite` struct contains only `product_id` (string) and `added_at` (timestamp). No quantity.

**Rationale**: Wishlist is for curation (what to buy), not for shopping (how many). Quantity belongs in cart.

---

## ADR-006: Atomic read-modify-write in RedisStore

**Status**: Accepted  
**Date**: 2026-04-14

**Decision**: Use JSON serialization + Redis StringGet/StringSet with TTL for atomic wishlist updates.

**Rationale**: Prevents race conditions on concurrent add/remove operations without requiring Redis WATCH or Lua scripts. Consistent with CartService protobuf serialization approach.

**Tradeoffs**: Not a true atomic transaction (two operations), but sufficient for the < 100ms SLA and low concurrent conflict probability.
