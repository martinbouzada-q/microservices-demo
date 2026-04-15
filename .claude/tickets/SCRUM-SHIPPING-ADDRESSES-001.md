# SCRUM-SHIPPING-ADDRESSES-001: Add Multiple Saved Shipping Addresses Feature

## 📋 User Story

**As a** customer who ships to multiple locations
**I want** to save and manage multiple shipping addresses
**So that** I can quickly select a saved address during checkout without re-entering address information each time

---

## 👥 Stakeholders

| Role              | Name              | Responsibility                                      |
| ----------------- | ----------------- | --------------------------------------------------- |
| Product Owner     | TBD               | Feature scope, address limit, default selection    |
| Backend Engineer  | TBD               | AddressService gRPC, storage, CRUD operations      |
| Frontend Engineer | TBD               | Address management UI, checkout address selection  |
| QA Engineer       | TBD               | Address validation, data integrity, edge cases     |

---

## 🎯 Success Criteria

1. Users can save up to 10 shipping addresses per session
2. Users can view all saved addresses in a dedicated address book
3. Users can add, edit, and delete saved addresses
4. Users can set one address as default (pre-selected at checkout)
5. Checkout form pre-fills with default address and allows quick address selection
6. Saved addresses persist for 48 hours (session TTL)
7. Address validation prevents invalid entries (required fields, format validation)
8. Performance: Address lookup/save completes in < 100ms
9. Users cannot view or modify other users' addresses (data isolation)
10. Address operations complete with zero data loss (atomic transactions)

**Metrics**:
- % of checkouts using saved addresses (vs. entering fresh)
- Average number of addresses saved per user
- Repeat checkout conversion rate
- Checkout form completion time reduction

---

## ✅ Acceptance Criteria

### Scenario 1: User adds first saved address

```gherkin
Scenario: User saves a shipping address for future use
  Given I am logged into my session
  And I have not saved any addresses yet
  When I navigate to "/addresses"
  Then I see a page titled "Shipping Addresses"
  And a message "You have no saved addresses"
  And an "Add New Address" button
  When I click "Add New Address"
  Then I see a form with fields:
    - Street Address (required)
    - City (required)
    - State (required)
    - Country (required)
    - Zip Code (required)
    - Address Label (optional, e.g., "Home", "Office", "Mom's House")
    - "Set as default" checkbox
  When I fill in all required fields and click "Save Address"
  Then the address is saved successfully
  And I see confirmation "Address saved successfully"
  And the address appears in my address book
  And the page loads in < 100ms
```

### Scenario 2: User views and manages saved addresses

```gherkin
Scenario: User views list of saved addresses
  Given I have 3 saved addresses:
    - Home (1600 Amphitheatre Parkway, Mountain View, CA 94043)
    - Office (351 Embarcadero, Palo Alto, CA 94301)
    - Mom's House (500 Memorial Blvd, Springfield, IL 62701)
  When I navigate to "/addresses"
  Then I see all 3 addresses listed with:
    - Address label (if provided) or "Address #1"
    - Full address preview
    - "Edit" button
    - "Delete" button
    - "Set as Default" button
  And the default address is marked with a badge "Default"
  And I can click "Edit" to modify any address
  And I can click "Delete" to remove an address
```

### Scenario 3: User edits a saved address

```gherkin
Scenario: User updates a saved address
  Given I have a saved address "Office" at "351 Embarcadero, Palo Alto, CA 94301"
  And I'm viewing my address book
  When I click "Edit" on the Office address
  Then I see the edit form pre-filled with:
    - Street Address: "351 Embarcadero"
    - City: "Palo Alto"
    - State: "CA"
    - Zip: "94301"
    - Country: "United States"
    - Label: "Office"
  When I change the street to "355 Main Street"
  And click "Update Address"
  Then the address is updated
  And I see confirmation "Address updated successfully"
  And the list shows the updated address
```

### Scenario 4: User sets default address

```gherkin
Scenario: User sets a default shipping address
  Given I have 3 saved addresses
  And "Home" is currently set as default
  When I click "Set as Default" on the "Office" address
  Then the system updates the default
  And "Office" now shows the "Default" badge
  And "Home" no longer shows the badge
  And I see confirmation "Office is now your default address"
```

### Scenario 5: Checkout form pre-fills with default address

```gherkin
Scenario: Checkout form automatically shows default address
  Given I have saved addresses with "Home" as default
  When I navigate to "/cart" and click "Checkout"
  Then the checkout form is pre-filled with:
    - Street Address: "1600 Amphitheatre Parkway"
    - City: "Mountain View"
    - State: "CA"
    - Zip: "94043"
    - Country: "United States"
  And an "Address" dropdown shows all my saved addresses:
    - [ ] Home (default, pre-selected)
    - [ ] Office
    - [ ] Mom's House
    - [+] Add New Address
  When I click the dropdown and select "Office"
  Then the form updates to show the Office address
  And I can proceed to checkout with this address
```

### Scenario 6: User adds new address during checkout

```gherkin
Scenario: User adds address while in checkout flow
  Given I'm in the checkout form
  And the address dropdown shows my saved addresses
  When I click "[+] Add New Address" in the dropdown
  Then a quick-add form appears (inline or modal) with:
    - All address fields (required fields marked)
    - Optional "Save for future use" checkbox (pre-checked)
    - "Save & Use This Address" button
  When I fill in the new address and click "Save & Use"
  Then the address is:
    - Saved to my address book
    - Automatically selected in the checkout form
    - Pre-filled in the shipping address section
  And I can proceed to complete the order
```

### Scenario 7: Address validation prevents invalid entries

```gherkin
Scenario: User cannot save invalid addresses
  Given I'm in the "Add Address" form
  When I try to save without filling required fields
  Then I see error messages:
    - "Street Address is required"
    - "City is required"
    - "State is required"
    - "Country is required"
    - "Zip Code is required"
  And the form is not submitted
  When I fill in "Zip Code: INVALID"
  Then I see error "Zip Code must be numeric (4-5 digits)"
  When I enter valid data for all fields
  Then the form submits successfully
```

### Scenario 8: User deletes a saved address

```gherkin
Scenario: User removes a saved address
  Given I have 3 saved addresses
  When I click "Delete" on the "Office" address
  Then a confirmation dialog appears:
    "Are you sure you want to delete this address? This action cannot be undone."
  When I click "Delete" in the confirmation
  Then the address is removed
  And I see confirmation "Address deleted successfully"
  And the address book now shows 2 addresses
  And if it was the default, a new default is automatically set
```

### Scenario 9: Address limit enforcement (max 10 addresses)

```gherkin
Scenario: User cannot save more than 10 addresses
  Given I have 10 saved addresses (at the limit)
  When I navigate to "/addresses"
  Then the "Add New Address" button is disabled
  And a message appears: "You have reached your address limit (10). Delete an address to add a new one."
  When I delete one address
  Then the "Add New Address" button becomes enabled
  And I can add another address
```

### Scenario 10: Saved addresses persist within session TTL

```gherkin
Scenario: Saved addresses available throughout session
  Given I saved 3 addresses 2 hours ago
  And my session cookie "shop_session-id" is still valid (before 48-hour expiry)
  When I close the browser and return after 1 hour
  And my session cookie is still valid
  When I navigate to "/addresses"
  Then all 3 saved addresses are still available
  And I can use them in checkout
  When 48 hours elapse (session expires)
  And I open the app with a new session
  Then my saved addresses are gone (expected, session-based storage)
```

---

## 🔧 Technical Context

### Current State

- **Address Submission**: User enters address fresh on every checkout (no pre-fill, no history)
- **Address Storage**: Addresses NOT stored anywhere; only passed through checkout flow
- **Address Data Model**: Proto `Address` with 5 fields (street, city, state, country, zip)
- **Validation**: Basic length checks (max 512 for street, max 128 for city/state/country)
- **User Identification**: Session-based UUID (`shop_session-id` cookie), no user accounts
- **Checkout Form**: Hard-coded test values; no autocomplete or address suggestions
- **Shipping Service**: Ignores address location; returns flat $8.99 rate

### Proposed Changes

1. **Create AddressService** (C# gRPC service)
   - Methods:
     - `CreateAddress(CreateAddressRequest) → Address`
     - `GetAddress(user_id, address_id) → Address`
     - `ListAddresses(user_id) → AddressesResponse`
     - `UpdateAddress(user_id, address_id, AddressRequest) → Address`
     - `DeleteAddress(user_id, address_id) → Empty`
     - `SetDefaultAddress(user_id, address_id) → Empty`
     - `GetDefaultAddress(user_id) → Address`
   - Storage: In-memory or Redis (session-scoped, 48-hour TTL)
   - Data model: Enhanced `Address` proto with `address_id`, `label`, `is_default`, `created_at`

2. **Extend Frontend Service** (Go)
   - New HTTP handlers:
     - `addressListHandler` (GET `/addresses`) — list all saved addresses
     - `addressCreateHandler` (POST `/addresses`) — save new address
     - `addressUpdateHandler` (PUT `/addresses/{id}`) — update address
     - `addressDeleteHandler` (DELETE `/addresses/{id}`) — delete address
     - `addressSetDefaultHandler` (POST `/addresses/{id}/set-default`) — set default
   - Modify `placeOrderHandler`:
     - Pre-fill form with default address
     - Add address dropdown/selector for quick selection
     - Allow adding new address during checkout (inline or modal)
   - New templates:
     - `addresses-list.html` — address book management
     - `address-form.html` — add/edit address form (reusable)
     - Modify `cart.html` — add address selector dropdown

3. **Update Proto Definitions** (`protos/demo.proto`)
   - Enhanced `Address` message:
     - Add `address_id` (string, UUID)
     - Add `label` (string, optional, e.g., "Home", "Office")
     - Add `is_default` (bool)
     - Add `created_at` (timestamp)
   - New `AddressService` definition with all RPC methods
   - New request/response messages for address operations

4. **Update CheckoutService** (optional but recommended)
   - Accept `address_id` parameter in `PlaceOrder` request
   - Look up address from AddressService using `address_id`
   - Fall back to inline address if `address_id` not provided (backward compatibility)
   - This simplifies validation and reduces repeated address data

### Technical Constraints

- **Session-Based Storage**: Addresses tied to session UUID, lost after 48-hour expiry
- **No User Accounts**: No persistent user profile; addresses not preserved across sessions
- **Data Isolation**: Critical — ensure users can only access their own addresses
- **In-Memory Storage**: Address lookup must be fast (< 100ms) for checkout performance
- **Address Limit**: Max 10 addresses per user (to prevent abuse and storage bloat)
- **No External Validation**: Don't integrate with address validation APIs (keep scope small)
- **gRPC Only**: All inter-service communication via insecure gRPC

### Integration Points

1. **Frontend Service** ↔ **AddressService**: gRPC calls for address CRUD and default address
2. **CheckoutService** → **AddressService**: Retrieve address by ID during order placement
3. **Frontend Service** ↔ **CheckoutService**: Modified `PlaceOrder` to accept `address_id`
4. **Session Middleware**: Session ID (user_id) extraction for address filtering
5. **Frontend Templates**: Checkout form address dropdown and address book UI

### Architecture Decisions

| Decision                           | Rationale                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Separate AddressService**        | Isolates address management; enables future features (address validation, autocompletion, geocoding).     |
| **Session-Based Storage**          | Consistent with existing system (no user auth yet). Trade-off: addresses lost after session expires.      |
| **Max 10 Addresses**               | Prevents storage bloat; covers 99% of use cases; avoids dropdown overwhelming on UI.                     |
| **Optional Label Field**           | Helps users distinguish addresses (Home, Office, etc.); improves UX without complicating data model.      |
| **Default Address Concept**        | Reduces friction at checkout; matches user mental model of "preferred" or "primary" address.            |
| **Address ID in CheckoutService**  | Simplifies validation, enables address history tracking, reduces data duplication.                       |
| **In-Memory + Session TTL**        | Fast lookups; no external database needed for MVP; aligns with session-based architecture.               |

---

## 🚫 Out of Scope

1. **Address Validation API** (USPS, Google Maps) — External service integration too complex for MVP
2. **Address Autocomplete** — Geocoding and suggestion service too heavy for MVP
3. **International Address Formats** — Assume US-style addresses (street, city, state, zip, country)
4. **Address Change Notification** — Don't notify user when addresses modified (can add later)
5. **Bulk Address Import** — File upload or API-based address import
6. **Address Alias or Nickname** — Beyond simple label field
7. **Shipping Address vs. Billing Address** — Only support single address for now
8. **Address History** — Don't track past checkout addresses; only user-saved addresses

**Future Considerations**:
- Add address validation against USPS/Google Maps API
- Implement autocomplete for faster address entry
- Support international address formats (non-US)
- Enable billing address (separate from shipping)
- Add address change notifications
- Support bulk address import
- Build address history (auto-save checkout addresses)

---

## ⚠️ Edge Cases & Error Handling

### Edge Cases

1. **User with 0 saved addresses**
   - **Handling**: Show empty state with "Add New Address" CTA; checkout form shows blank form

2. **User with exactly 1 address**
   - **Handling**: This address automatically becomes default; dropdown on checkout shows just this address + "Add New"

3. **Default address is deleted**
   - **Handling**: Automatically promote oldest/first remaining address to default; if no addresses left, checkout form is blank

4. **Address label not provided**
   - **Handling**: Generate label as "Address #N" or "Saved Address" + date; allow user to add label later via edit

5. **User attempts to save duplicate addresses**
   - **Handling**: Allow duplicates (user might need to send to same address multiple times); no deduplication

6. **Session expires (48 hours)**
   - **Handling**: Addresses lost when session cookie expires; transparent to user (addresses only in current browser)

7. **Very long address fields**
   - **Handling**: Truncate display (e.g., street > 50 chars shows "123 Very Long Street Na..." with full text in tooltip)

8. **User modifies address while checkout form has it selected**
   - **Handling**: Checkout form maintains the selected address-id; if user updates that address in another tab, checkout sees updated data on next page load

### Error Scenarios

| Error Condition                          | User Message                                                  | System Behavior                                   |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| AddressService unavailable               | "Unable to load addresses. Please enter address manually."    | Fall back to manual entry; log error             |
| Address not found (invalid ID)           | 404 error or address not shown in list                        | Return 404; don't reveal existence of other addresses |
| User tries to access another's address   | 403 Forbidden or "Access denied"                              | Return 403; log security event                   |
| Required field missing                   | "Street Address is required" (per field)                      | Prevent form submission; highlight field        |
| Invalid zip code format                  | "Zip Code must be 4-5 numeric digits"                         | Show inline error; prevent submission            |
| Duplicate address label (same user)      | Allow (no error)                                              | Permit duplicate labels; not a constraint        |
| Address limit reached (10 addresses)     | "You have reached your address limit (10)"                    | Disable "Add" button; show message               |
| Database/storage write fails             | "Unable to save address. Please try again."                   | Return 5xx error; client can retry               |
| Zip code overflow (> 5 digits)           | "Zip Code must be 4-5 numeric digits"                         | Show error; truncate input                       |

### Data Validation Rules

- **Street Address**: String, 3-512 characters, required, alphanumeric + common symbols (,.-#&)
- **City**: String, 2-128 characters, required, alphanumeric + spaces/hyphens
- **State**: String, 2-128 characters, required, alphanumeric + spaces (support full names and abbreviations)
- **Country**: String, 2-128 characters, required, alphanumeric + spaces
- **Zip Code**: Integer or string, 4-5 digits, required, numeric only, regex: `^\d{4,5}$`
- **Label**: String, 0-50 characters, optional, alphanumeric + spaces/hyphens (e.g., "Home", "Office", "Mom's House")
- **Address ID**: UUID format (auto-generated)
- **Max Addresses Per User**: 10

---

## 📦 Dependencies

### Blocking

- [ ] None — Can be developed independently

### Related

- **SCRUM-1** — Wishlist feature (uses session-based user ID)
- **SCRUM-2** — Order History (may want to display original shipping address from orders)
- **SCRUM-3** — Checkout Service (will integrate address_id parameter)

### Infrastructure

- **gRPC**: Already available across all services
- **Session Storage**: Existing session middleware (Redis or in-memory)
- **Go templates**: Already available in frontend service
- **C# / .NET 10.0**: Already available for AddressService

---

## 🎓 Definition of Done

### Code Quality

- [ ] Unit test coverage ≥ 80% (AddressService)
- [ ] No hardcoded values; use environment variables (`ADDRESS_SERVICE_ADDR`, storage type)
- [ ] Code follows project conventions (Go handlers, C# service pattern)
- [ ] Proto definitions documented (all fields, constraints)
- [ ] No SQL injection, XSS, or CSRF vulnerabilities
- [ ] Input validation on both frontend and backend
- [ ] Proper error handling for validation failures

### Testing

- [ ] All 10 BDD scenarios automated (integration tests)
- [ ] Address validation tests (required fields, format, length)
- [ ] Data isolation test: User A cannot see/modify User B's addresses
- [ ] Concurrency test: Multiple users saving addresses simultaneously
- [ ] Edge cases: 0 addresses, 1 address, 10 addresses, 11+ addresses (limit)
- [ ] Delete default address: new default automatically set
- [ ] Checkout address pre-fill: form populated with default address
- [ ] Error scenarios: service down, invalid address ID, timeout
- [ ] Manual testing: Address management UI responsive across screen sizes

### Documentation

- [ ] Proto definitions documented (all fields, constraints, limits)
- [ ] API endpoints documented (CRUD operations, parameters, response format)
- [ ] Frontend handlers documented (request/response format, error codes)
- [ ] Address validation rules documented
- [ ] Checkout integration documented (address selection, fallback to manual entry)
- [ ] Troubleshooting guide (common validation errors, recovery)

### Review & Deployment

- [ ] Code reviewed and approved (1+ reviewer)
- [ ] All CI checks passing (linting, type checking, tests)
- [ ] PR merged to main branch
- [ ] Feature flag: Address feature enabled by default
- [ ] Monitoring: Address CRUD operation latency tracked (target: < 100ms)

### Infrastructure

- [ ] AddressService deployed and healthy
- [ ] Address storage configured (in-memory with session TTL)
- [ ] Traces exported for observability

---

## 📝 Implementation Notes

**For Backend Engineer (AddressService)**:
- Create new `AddressService` gRPC service in C#/.NET
- Implement CRUD methods: Create, Read, Update, Delete, SetDefault
- Store addresses in session-scoped storage (in-memory or Redis with 48-hour TTL)
- Ensure data isolation: all queries must filter by `user_id` (session ID)
- Validate all input: required fields, format (zip code), length limits
- Enforce max 10 addresses per user
- When default address deleted, promote oldest remaining to default
- Environment variable: `ADDRESS_SERVICE_ADDR` for frontend to call

**For Frontend Engineer**:
- Add new routes: `GET /addresses` (list), `POST /addresses` (create), `PUT /addresses/{id}` (update), `DELETE /addresses/{id}` (delete)
- Create templates: `addresses-list.html`, `address-form.html`
- Modify `cart.html` checkout section:
  - Pre-fill form with default address via gRPC call
  - Add address dropdown showing all saved addresses
  - Add "[+] Add New Address" option in dropdown
  - Implement inline quick-add form for new addresses (modal or collapsible)
- Add "Manage Addresses" link to account/header navigation
- Format address display with line breaks (street on one line, city/state/zip on another)
- Show "Default" badge on default address in list
- Implement confirmation dialog before deleting addresses
- Handle loading states, errors (address service down → manual entry fallback)

**For QA Engineer**:
- Test user isolation: User A cannot view/modify User B's saved addresses
- Test CRUD operations: Create, read, update, delete, all validation paths
- Test limit enforcement: Cannot save 11+ addresses; disable button at 10
- Test default address: Automatically set on first save; can change; auto-promoted when deleted
- Test checkout pre-fill: Default address appears in form
- Test address selection: Changing dropdown updates form fields
- Test inline address add: New address saves and is auto-selected in checkout
- Test validation: All required fields enforced; zip code format validated; max length enforced
- Test session persistence: Addresses available throughout 48-hour session
- Test cleanup: Addresses deleted when session expires (verify log cleanup job if implemented)

**Known Gotchas**:
- **Session-Based Only**: Addresses lost after 48 hours; users won't see them from different browser/device until user auth is added
- **No Persistence**: Addresses stored in-memory or Redis with TTL; old addresses not kept for analytics
- **Address ID Critical**: If using `address_id` in CheckoutService, must handle case where address is deleted between form load and submission
- **Dropdown Size**: With 10 addresses max, dropdown should be manageable; if increasing limit, consider pagination
- **Label Uniqueness**: Don't enforce unique labels; users might want "Home" for two different homes

---

## 🔗 References

- **Checkout Flow**: `src/frontend/handlers.go` (placeOrderHandler), `src/checkoutservice/main.go` (PlaceOrder)
- **Address Model**: `protos/demo.proto` (Address message)
- **Cart Template**: `src/frontend/templates/cart.html` (checkout form structure)
- **Frontend Validation**: `src/frontend/validator/validator.go` (address validation)
- **Session Middleware**: `src/frontend/middleware.go` (sessionID extraction)
- **CartService Pattern**: `src/cartservice/src/services/CartService.cs` (reference for service CRUD pattern)

---

**Metadata**:
- **Created**: 2026-04-14
- **Created By**: Claude SDD Generator (from input: "Permitir guardar múltiples direcciones de envío")
- **INVEST Validated**: ✅ (All criteria met; estimated 5-7 days)
- **BDD Scenarios**: 10 (comprehensive: CRUD, validation, persistence, edge cases, security)
- **Priority**: Medium (convenience feature; improves checkout experience)
- **Labels**: `feature`, `sdd`, `microservices`, `frontend`, `backend`
- **Complexity**: Medium (new service, storage, UI integration, but scoped MVP)
