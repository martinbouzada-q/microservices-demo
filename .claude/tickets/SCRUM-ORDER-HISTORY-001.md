# SCRUM-ORDER-HISTORY-001: Add Purchase History UI to Display User Orders

## 📋 User Story

**As a** customer who has made purchases in the Online Boutique
**I want** to view my complete purchase history with order details, shipping information, and status
**So that** I can track my purchases, reference past orders, and reorder items easily

---

## 👥 Stakeholders

| Role              | Name              | Responsibility                                      |
| ----------------- | ----------------- | --------------------------------------------------- |
| Product Owner     | TBD               | Business value, feature scope, retention strategy  |
| Backend Engineer  | TBD               | OrderService gRPC, persistence layer, APIs         |
| Frontend Engineer | TBD               | Order history UI, templates, routing               |
| Database Admin    | TBD               | Schema design, indexing, backup strategy           |
| QA Engineer       | TBD               | Test automation, data integrity, performance       |

---

## 🎯 Success Criteria

1. Users can view a list of all their past purchases with order ID, date, total, and status
2. Users can click on an order to view detailed information (items, shipping address, tracking number)
3. Order history persists across sessions (survives 48-hour session expiry and browser restarts)
4. Orders are retrieved from persistent storage (database) within < 200ms
5. Order list supports pagination (20 orders per page)
6. Order details include payment status, shipping status, and tracking link
7. Users cannot view other users' order history (data isolation)
8. Performance: Loading 100+ orders completes in < 500ms

**Metrics**:
- Order history page load time (target: < 500ms)
- User engagement: % of users who view order history
- Repeat order conversion rate (orders placed from history view)
- Data consistency: 100% orders stored match placed orders

---

## ✅ Acceptance Criteria

### Scenario 1: User views order history list

```gherkin
Scenario: User views list of past orders
  Given I have made 3 purchases in the past
  And my session ID is "550e8400-e29b-41d4-a716-446655440000"
  When I navigate to "/orders"
  Then I see a page titled "Purchase History"
  And each order displays:
    - Order ID (e.g., "ORD-20260414-001")
    - Order date (e.g., "April 14, 2026")
    - Order total (e.g., "$47.99")
    - Number of items (e.g., "3 items")
    - Order status badge (e.g., "Delivered", "Processing", "Shipped")
  And orders are sorted by most recent first
  And the page loads in < 500ms
```

### Scenario 2: User views order details

```gherkin
Scenario: User clicks on order to view details
  Given I am on the purchase history list
  And I can see order "ORD-20260414-001"
  When I click on the order
  Then I see the order detail page with:
    - Order ID and date/time
    - Complete list of items (product name, quantity, price each, subtotal)
    - Subtotal, shipping cost, and total amount
    - Order status timeline (Placed → Processing → Shipped → Delivered)
    - Shipping address
    - Tracking number with carrier link
    - Payment method (last 4 digits of card)
    - Estimated delivery date
  And the page loads in < 200ms
```

### Scenario 3: Order history persists across sessions

```gherkin
Scenario: Order history available after session expiry
  Given I placed an order 2 hours ago
  And my session cookie "shop_session-id" is valid
  When I close the browser and return after 46 hours (before 48-hour expiry)
  And my session cookie is still valid
  When I navigate to "/orders"
  Then I see all my past orders including the one from 2 hours ago
  And the order data is complete and unchanged
```

### Scenario 4: User with no orders sees empty state

```gherkin
Scenario: New user views empty order history
  Given I am a new customer with no previous orders
  And my session ID is "11111111-1111-1111-1111-111111111111"
  When I navigate to "/orders"
  Then I see a page titled "Purchase History"
  And a message "You haven't placed any orders yet"
  And a "Start Shopping" button linking to "/"
  And no loading spinner (empty state loads instantly)
```

### Scenario 5: Order pagination works correctly

```gherkin
Scenario: User navigates through multiple pages of orders
  Given I have 67 orders in my history
  And each page shows 20 orders
  When I navigate to "/orders"
  Then I see page 1 with orders 1-20
  And a pagination footer showing "Page 1 of 4"
  And "Next" button is enabled
  When I click "Next"
  Then I see page 2 with orders 21-40
  And "Previous" button is now enabled
  And URL changes to "/orders?page=2"
  When I click "Previous"
  Then I'm back on page 1
```

### Scenario 6: Order status displays correctly

```gherkin
Scenario: Order status reflects current state
  Given I placed an order that has been shipped
  And the shipping tracking ID is "1Z999AA10123456784"
  When I view the order details
  Then the order status shows "Shipped"
  And the status timeline shows:
    ✅ Placed (April 14, 2026 2:30 PM)
    ✅ Processing (April 14, 2026 3:15 PM)
    ✅ Shipped (April 15, 2026 9:00 AM)
    ⏳ Delivery (Estimated April 17, 2026)
  And the tracking number displays as a clickable link to carrier
```

### Scenario 7: Data isolation - users cannot view others' orders

```gherkin
Scenario: User cannot access another user's order history
  Given there is another user with order ID "ORD-20260414-999"
  And my session ID is "550e8400-e29b-41d4-a716-446655440000"
  When I try to access "/order/ORD-20260414-999" directly
  Then I see a 404 error or access denied message
  And I cannot view their order details
  And my audit log shows the unauthorized access attempt
```

### Scenario 8: Order history search/filter (future-ready)

```gherkin
Scenario: User filters orders by status
  Given I have orders with various statuses (Delivered, Processing, Shipped)
  When I click the "Status" filter dropdown
  Then I see filter options: All Orders, Processing, Shipped, Delivered
  When I select "Delivered"
  Then only delivered orders display in the list
  And the count updates (e.g., "Showing 5 of 23 orders")
```

### Scenario 9: Error handling - database unavailable

```gherkin
Scenario: Graceful failure when order storage is unavailable
  Given the order database is temporarily unavailable
  When I navigate to "/orders"
  Then I see a friendly error message: "Unable to load purchase history. Please try again later."
  And a "Retry" button is available
  And the page doesn't crash or show technical errors
```

### Scenario 10: Performance - loading large order history

```gherkin
Scenario: User with 200+ orders loads history efficiently
  Given I have 200 orders in the database
  When I navigate to "/orders" (first page, 20 items)
  Then the page loads in < 500ms
  And pagination controls are available
  When I navigate to page 10 (orders 181-200)
  Then the page loads in < 200ms
  And database query uses proper indexing
```

---

## 🔧 Technical Context

### Current State

- **Order Creation**: CheckoutService orchestrates order placement (cart items → shipping → payment → email)
- **Order Data Model**: `OrderResult` contains order ID, items, shipping tracking, address, and cost
- **Order Persistence**: **NO STORAGE** — Orders lost after confirmation page displayed
- **User Identification**: Session-based UUID (`shop_session-id` cookie), no email-to-user mapping
- **Storage Backend**: CartService uses Redis/Spanner/AlloyDB, but OrderService doesn't exist
- **Checkout Flow**: Creates order, charges payment, ships, sends email, empties cart, then order disappears
- **Email Service**: Receives OrderResult but only for confirmation email, doesn't persist

### Proposed Changes

1. **Create OrderService** (C# gRPC service)
   - Methods: 
     - `CreateOrder(CreateOrderRequest) → Order`
     - `GetOrder(user_id, order_id) → Order`
     - `ListOrders(user_id, limit, offset) → OrdersResponse`
     - `UpdateOrderStatus(order_id, status) → Empty`
   - Storage: Persistent database (PostgreSQL, Firestore, or AlloyDB)
   - Data model: Enhanced `Order` proto with timestamps, payment status, tracking status

2. **Extend CheckoutService**
   - After successful payment/shipping, call `OrderService.CreateOrder` to persist order
   - Store: order ID, user ID (session), created timestamp, total cost, payment transaction ID, shipping tracking ID
   - Link to email confirmation for tracking

3. **Update Proto Definitions** (`protos/demo.proto`)
   - New `OrderService` definition
   - Enhanced `Order` message with:
     - `created_at` (timestamp)
     - `user_id` (session ID)
     - `payment_transaction_id`
     - `payment_status` (pending, completed, failed)
     - `shipping_status` (placed, processing, shipped, delivered)
     - `estimated_delivery_date`

4. **Extend Frontend Service** (Go)
   - New HTTP handlers:
     - `ordersListHandler` (GET `/orders`) — paginated list
     - `orderDetailHandler` (GET `/order/{id}`) — order details
   - New templates:
     - `orders-list.html` — purchase history list with pagination
     - `order-detail.html` — full order details page
   - Add "View Orders" link to header navigation
   - Add "View my orders" button after checkout

5. **Database Schema** (choose one backend)
   - Table: `orders` with columns:
     - `order_id` (string, primary key)
     - `user_id` (string, indexed for query performance)
     - `created_at` (timestamp)
     - `items` (JSON or separate items table)
     - `total_cost` (money)
     - `payment_status` (enum)
     - `shipping_status` (enum)
     - `shipping_tracking_id` (string, nullable)
     - `shipping_address` (JSON)
   - Index on `(user_id, created_at DESC)` for efficient history queries

### Technical Constraints

- **Session-Based Identity**: User identified by session UUID, not email. No persistent user accounts.
- **48-Hour Session TTL**: Order history must survive beyond single session; needs user→order mapping
- **No Email-User Linking**: System doesn't maintain email-to-user-ID mapping; must use session ID as identifier
- **Stateless Frontend**: Cannot assume user state; must query backend for order history
- **gRPC Only**: Inter-service communication via insecure gRPC
- **Data Isolation**: Ensure users can only view their own orders (critical security requirement)
- **Performance**: Order queries must use database indexes; avoid N+1 queries
- **Scalability**: Support users with 100+ orders efficiently

### Integration Points

1. **Frontend Service** ↔ **OrderService**: gRPC calls to retrieve order history
2. **CheckoutService** → **OrderService**: After successful checkout, persist order
3. **Frontend Service** ↔ **ProductCatalogService**: Fetch product names/images for order detail display
4. **Frontend Service** ↔ **ShippingService**: Optional — Get live tracking status updates
5. **Session Middleware**: Session ID extraction from cookie, used as user_id in order queries
6. **Database**: New persistent storage (PostgreSQL, Firestore, AlloyDB, or Redis)

### Architecture Decisions

| Decision                           | Rationale                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Separate OrderService**          | Keeps order management independent; allows future enhancements (order modifications, cancellations, returns). |
| **Persistent Database**            | Orders must survive session expiry; in-memory storage insufficient.                                       |
| **Session-ID as User ID**          | Consistent with existing system; no auth/user accounts yet. Trade-off: limits order persistence across browsers. |
| **Enhanced Order Proto**           | Add timestamps and status fields for complete order lifecycle tracking.                                   |
| **Pagination (20 items/page)**     | Balances UI performance with complete history access; prevents loading 100+ items at once.               |
| **Index on (user_id, created_at)** | Enables fast "list orders by user" queries; essential for performance at scale.                          |
| **No Real-Time Tracking**          | MVP focuses on static order history; live tracking updates can be added later.                           |

---

## 🚫 Out of Scope

1. **Order Modifications** (cancel, change address, modify items) — Future feature
2. **Real-Time Tracking Updates** (push notifications when status changes) — Can be added later
3. **Order Analytics** (user spending trends, popular products) — Separate analytics feature
4. **Reorder from History** (quick-reorder button) — Future convenience feature
5. **Order Returns/Refunds** — Separate returns management system
6. **Email Reconciliation** (link orders by email) — Requires user authentication
7. **Order Export** (CSV, PDF download) — Future feature
8. **International Order Tracking** (multi-carrier support) — Can expand later

**Future Considerations**:
- Once user authentication is added, enable cross-device order history
- Add order notifications (status updates via email/SMS)
- Implement 1-click reorder functionality
- Build order analytics dashboard for users
- Add order search and advanced filtering
- Support order returns and refund tracking

---

## ⚠️ Edge Cases & Error Handling

### Edge Cases

1. **User with 0 orders**
   - **Handling**: Show empty state with "Start Shopping" CTA; no error

2. **User with 1000+ orders**
   - **Handling**: Paginate in chunks of 20; ensure database queries complete in < 200ms; consider archiving very old orders

3. **Order placed but database write failed**
   - **Handling**: Log error; send email confirmation anyway (order created in-memory); implement reconciliation job to sync missed orders

4. **Session expired but order history requested**
   - **Handling**: User ID (session ID) is in the cookie, so queries still work until cookie expires at 48-hour mark. After expiry, show "Session expired, please log in" (when auth is added)

5. **User navigates directly to `/order/{invalid-id}`**
   - **Handling**: Return 404 or access-denied; don't reveal if order exists or not

6. **Payment succeeded but shipping failed**
   - **Handling**: Order is stored with `payment_status=completed, shipping_status=failed`. UI shows this state; admin can manually retry shipping.

7. **Multiple concurrent requests for same order**
   - **Handling**: Database ensures atomic reads; no race conditions.

8. **Order created in one browser, viewed in another (same session ID)**
   - **Handling**: Should work if session cookie is shared (same domain); won't work if user clears cookies and opens new session

### Error Scenarios

| Error Condition                          | User Message                                                  | System Behavior                                   |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| OrderService database unavailable        | "Unable to load purchase history. Please try again later."    | Return 503, show error; backend logs incident    |
| Order not found (invalid ID)             | 404 error or "Order not found"                                | Return 404; don't reveal existence of other orders |
| User tries to view another's order       | 403 Forbidden or "Access denied"                              | Return 403; log security event                   |
| Database query timeout (> 5s)            | "Your request took too long. Please refresh and try again."   | Return 504; client-side retry available         |
| Payment transaction ID missing           | Show order with note: "Payment details unavailable"           | System recovers; shows available data            |
| Shipping tracking unavailable            | Show order with note: "Tracking not yet available"            | Graceful degradation; show what data exists      |
| Pagination offset out of range           | Show last page or first page (depending on direction)         | Clamp offset to valid range; no error             |

### Data Validation Rules

- **Order ID**: String format `ORD-YYYYMMDD-NNN`, 1-30 characters, alphanumeric + dash only
- **User ID**: UUID format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (session ID)
- **Pagination Limit**: Integer 1-100 (default 20)
- **Pagination Offset**: Integer ≥ 0, must be multiple of limit
- **Order Status**: Enum: `placed`, `processing`, `shipped`, `delivered`, `failed`, `cancelled`
- **Total Cost**: Money struct (units + nanos), must match sum of item costs + shipping

---

## 📦 Dependencies

### Blocking

- [ ] None — Can be developed in parallel with other features

### Related

- **SCRUM-1** — Wishlist feature (both use session-based user ID)
- **SCRUM-2** — Cart Service (reference for backend abstraction patterns)
- **SCRUM-3** — Checkout Service (must integrate for order persistence)
- **SCRUM-4** — Email Service (coordinate confirmation details)

### Infrastructure

- **gRPC**: Already available across all services
- **Persistent Database**: Must add (PostgreSQL, Firestore, AlloyDB, or Redis with persistence)
- **Go templates**: Already available in frontend service
- **C# / .NET 10.0**: Already available for OrderService

---

## 🎓 Definition of Done

### Code Quality

- [ ] Unit test coverage ≥ 80% (OrderService)
- [ ] Integration tests with real database (not mocks)
- [ ] No hardcoded values; use environment variables (`ORDERS_DB_CONNECTION`, `ORDER_SERVICE_ADDR`)
- [ ] Code follows project conventions (Go handlers, C# service pattern)
- [ ] Proto definitions documented (request/response fields)
- [ ] No SQL injection, XSS, or CSRF vulnerabilities
- [ ] Proper error handling for database failures

### Testing

- [ ] All 10 BDD scenarios automated (integration tests)
- [ ] Load test: 100+ concurrent order history queries complete in < 500ms
- [ ] Data isolation test: User A cannot see User B's orders
- [ ] Pagination test: Page navigation, boundary cases, out-of-range offsets
- [ ] Edge cases: empty history, single order, very large history (1000+ orders)
- [ ] Error scenarios: DB down, timeout, invalid order ID, malicious access attempts
- [ ] Manual testing: Order history UI renders correctly across screen sizes

### Documentation

- [ ] Proto definitions documented (request/response fields)
- [ ] Database schema documented (table structure, indexes, constraints)
- [ ] API endpoints documented (ListOrders, GetOrder, parameters, response format)
- [ ] Frontend handlers documented (request/response format, error codes)
- [ ] Environment variables documented (ORDERS_DB_CONNECTION, etc.)
- [ ] Troubleshooting guide (common errors, recovery steps)
- [ ] Data migration guide (how to handle existing orders from email service)

### Review & Deployment

- [ ] Code reviewed and approved (1+ reviewer)
- [ ] All CI checks passing (linting, type checking, tests)
- [ ] Database schema migrations tested (forward and rollback)
- [ ] PR merged to main branch
- [ ] Feature flag: Order history visible by default (no rollout needed)
- [ ] Monitoring: Order query latency tracked in traces (target: < 200ms)
- [ ] Database backups configured and tested

### Infrastructure

- [ ] OrderService deployed and healthy
- [ ] Database connection pooling configured
- [ ] Database indexes created and verified
- [ ] Monitoring alerts for slow queries (threshold: 500ms)
- [ ] Audit logging enabled for access to order data
- [ ] Traces exported to collector for observability

---

## 📝 Implementation Notes

**For Backend Engineer (OrderService)**:
- Create new `OrderService` gRPC service in C#/.NET (reference `CartService` pattern)
- Implement database abstraction layer for order persistence
- Add methods: `CreateOrder`, `GetOrder`, `ListOrders`, `UpdateOrderStatus`
- Use proper indexing on `(user_id, created_at DESC)` for efficient queries
- Ensure data isolation: all queries must filter by user_id
- Handle database connection failures gracefully
- Environment variables: `ORDERS_DB_CONNECTION`, `ORDERS_DB_TYPE` (postgres|firestore|alloydb)

**For Frontend Engineer**:
- Add new routes: `GET /orders` (list), `GET /order/{id}` (detail)
- Create templates: `orders-list.html`, `order-detail.html`
- Implement pagination: page param, next/prev buttons, page count
- Add "Purchase History" link to navigation header
- Add "View my orders" button on checkout confirmation page
- Handle loading states, errors, and empty states
- Format prices with currency symbol from session
- Make order status badges color-coded (green=delivered, yellow=processing, red=failed)
- Ensure responsive design on mobile (orders are clickable links)

**For Database Admin**:
- Set up persistent database (PostgreSQL recommended for reliability)
- Create `orders` table with proper schema (see schema in Technical Context)
- Create index on `(user_id, created_at DESC)` for fast user order queries
- Set up automated backups (daily minimum)
- Configure connection pooling (min 5, max 20 connections)
- Test failover/recovery procedures

**For QA Engineer**:
- Test user isolation: User A cannot access User B's orders even with direct URL manipulation
- Test pagination boundaries: 0 orders, 1 order, 19 orders, 20 orders, 21 orders, 1000+ orders
- Test session expiry: Orders visible until 48-hour cookie expiry
- Test concurrent access: Multiple users simultaneously querying order history
- Test error scenarios: DB down, timeout, malformed order ID
- Performance test: 1000 concurrent requests to list orders (target: all < 500ms)
- Data consistency: Verify all created orders appear in history

**Known Gotchas**:
- **Session vs. User ID**: System uses session UUID as user identifier; no persistent user accounts yet. Orders tied to session, not email.
- **Database Performance**: Without `(user_id, created_at)` index, queries become slow at 100+ orders per user.
- **Cross-Device Access**: Orders only accessible from same browser (same session cookie) until user authentication is added.
- **Email Reconciliation**: Can't link existing orders (from emails) to users until email addresses are stored with orders and user auth is added.
- **Database Selection**: Choice of database impacts migration timeline; PostgreSQL is safest, Firestore is easiest for GCP, AlloyDB is good if already using GCP.

---

## 🔗 References

- **CheckoutService**: `src/checkoutservice/main.go` (PlaceOrder orchestration)
- **CartService**: `src/cartservice/src/services/CartService.cs` (reference for service pattern)
- **Frontend Handlers**: `src/frontend/handlers.go` (placeOrderHandler, other handlers)
- **Cart Template**: `src/frontend/templates/cart.html` (UI pattern for list views)
- **Proto Definition**: `protos/demo.proto` (Order, OrderResult messages)
- **Email Service**: `src/emailservice/templates/confirmation.html` (order data used)
- **Session Middleware**: `src/frontend/middleware.go` (sessionID extraction)

---

**Metadata**:
- **Created**: 2026-04-14
- **Created By**: Claude SDD Generator (from input: "Agregar historial de compras en la UI")
- **INVEST Validated**: ✅ (All criteria met; estimated 8-10 days)
- **BDD Scenarios**: 10 (comprehensive coverage of happy path, edge cases, performance, security)
- **Priority**: High (critical feature for customer experience and retention)
- **Labels**: `feature`, `sdd`, `microservices`, `frontend`, `backend`, `database`
- **Complexity**: Medium-High (requires new service, database, integration)
