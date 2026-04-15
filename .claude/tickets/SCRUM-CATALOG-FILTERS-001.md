# SCRUM-CATALOG-FILTERS-001: Add Price and Category Filters to Product Catalog

## 📋 User Story

**As a** customer browsing the product catalog
**I want** to filter products by price and category
**So that** I can quickly find products I'm interested in without scrolling through the entire catalog

---

## 👥 Stakeholders

| Role              | Name              | Responsibility                                      |
| ----------------- | ----------------- | --------------------------------------------------- |
| Product Owner     | TBD               | Category taxonomy, price ranges, sorting options   |
| Backend Engineer  | TBD               | Filter RPC endpoints, filtering logic, optimization|
| Frontend Engineer | TBD               | Filter UI, state management, URL parameter handling|
| QA Engineer       | TBD               | Filter combinations, edge cases, performance       |

---

## 🎯 Success Criteria

1. Users can filter products by selecting one or more categories
2. Users can filter products by price range (min/max sliders or input fields)
3. Users can sort products by price (ascending/descending) and name (A-Z/Z-A)
4. Filter results update in real-time as filters are adjusted
5. Filter state persists in URL parameters (bookmarkable/shareable links)
6. Applied filters display as removable "chips" or "tags" above product list
7. Product count updates to reflect filtered results
8. Filtering completes in < 200ms even with 1000+ products
9. Empty state shows helpful message when no products match filters
10. Mobile-friendly filter UI (collapsible on small screens)

**Metrics**:
- % of users who use filters
- Average number of filters applied per session
- Conversion rate for filtered products vs. browsing all
- Filter operation response time

---

## ✅ Acceptance Criteria

### Scenario 1: User filters products by single category

```gherkin
Scenario: User selects a category filter
  Given I am on the home page with all 9 products displayed
  And I can see a "Filters" panel on the left sidebar with:
    - Categories: accessories, clothing, footwear, hair-beauty, home-decor, kitchen
    - Price Range: $0 - $100+ (slider or inputs)
  When I click the checkbox for "Accessories"
  Then the product grid updates to show only 2 accessories products:
    - Sunglasses ($19.99)
    - Gold Plated Earrings ($34.99)
  And the URL changes to "/?category=accessories"
  And a "Accessories" filter chip appears above the product list with an X to remove it
  And the product count shows "Showing 2 products"
  And the page updates in < 200ms
```

### Scenario 2: User applies multiple category filters (OR logic)

```gherkin
Scenario: User selects multiple categories
  Given I have "Accessories" category selected
  When I also click "Kitchen" category
  Then the product grid updates to show:
    - All 2 accessories products
    - All 3 kitchen products
    - Total: 5 products
  And the URL shows "/?category=accessories&category=kitchen"
  And two filter chips display: "Accessories" and "Kitchen"
  And the product count shows "Showing 5 products"
  And results are the union (OR) of both categories, not intersection
```

### Scenario 3: User filters by price range

```gherkin
Scenario: User adjusts price range slider
  Given I am on the home page with all products visible
  And the price range slider shows $0 - $100+
  When I adjust the minimum price slider to $20
  And adjust the maximum price slider to $50
  Then the product grid updates to show only products in that price range:
    - Gold Plated Earrings ($34.99)
    - Bamboo Spatula ($23.99)
    - Other products in $20-$50 range
  And the URL updates to "/?minPrice=20&maxPrice=50"
  And filter chips show "Min: $20" and "Max: $50"
  And the product count updates
  And results update as I drag the sliders (debounced, < 200ms)
```

### Scenario 4: User sorts filtered results

```gherkin
Scenario: User sorts filtered products by price
  Given I have filtered to show "Kitchen" products (3 items)
  And I can see a "Sort by" dropdown with options:
    - Relevance (default)
    - Price: Low to High
    - Price: High to Low
    - Name: A-Z
    - Name: Z-A
  When I select "Price: Low to High"
  Then the products are re-sorted by price ascending:
    1. Bamboo Spatula ($23.99)
    2. Bamboo Spoon ($25.00)
    3. Bamboo Pan ($85.49)
  And the URL updates to "/?category=kitchen&sort=price_asc"
  And the sort dropdown shows "Price: Low to High" as selected
```

### Scenario 5: User clears filters

```gherkin
Scenario: User removes all filters
  Given I have filters applied:
    - Category: Accessories
    - Price: $20 - $50
    - Sort: Price: High to Low
  When I click the "Clear All" button
  Then all filters are removed
  And the product grid shows all 9 products again
  And all filter chips disappear
  And the URL returns to "/"
  And the sort dropdown resets to "Relevance"
  And the product count shows "Showing 9 products"
```

### Scenario 6: User removes individual filter

```gherkin
Scenario: User removes a single filter by clicking X on chip
  Given I have filters applied:
    - Category: Accessories
    - Price: $20 - $50
  When I click the X on the "Accessories" chip
  Then only the Accessories filter is removed
  And the price filter remains ($20 - $50)
  And the URL updates to "/?minPrice=20&maxPrice=50"
  And products are now filtered only by price
```

### Scenario 7: Filter state persists in URL (bookmarkable)

```gherkin
Scenario: User shares filtered URL
  Given I have filters applied:
    - Category: Clothing
    - Sort: Price: Low to High
  And the URL is "/?category=clothing&sort=price_asc"
  When I copy the URL and share it with a friend
  And my friend opens the URL
  Then the filters are automatically applied:
    - "Clothing" category is checked
    - Products are sorted by price ascending
    - Filter chips are displayed
    - No additional clicks needed to restore the view
```

### Scenario 8: Empty state when no products match filters

```gherkin
Scenario: User applies filters that match no products
  Given I have filters applied:
    - Price: $0 - $5 (a range with no products)
  Then the product grid shows an empty state with:
    - Message: "No products found matching your filters"
    - "Clear filters" button to reset
    - Suggested categories to explore
  And the product count shows "Showing 0 products"
```

### Scenario 9: Mobile filter UI (collapsible sidebar)

```gherkin
Scenario: User views filters on mobile device
  Given I am viewing the catalog on a mobile device (< 768px width)
  When I load the home page
  Then the filter sidebar is collapsed by default
  And a "Filters" button is visible at the top
  When I click the "Filters" button
  Then the filter panel expands (overlay or slide-out drawer)
  And I can select filters
  And when I click outside or close the panel, it collapses
  And the product grid takes full width
```

### Scenario 10: Filter performance with large catalog

```gherkin
Scenario: Filtering 1000+ products completes quickly
  Given the catalog has been expanded to 1000+ products
  When I apply multiple filters:
    - Category: Kitchen
    - Price: $20 - $100
    - Sort: Price ascending
  Then the results load and display in < 200ms
  And the UI remains responsive (no freezing)
  And results are correctly filtered and sorted
```

---

## 🔧 Technical Context

### Current State

- **Product Catalog**: 9 products stored in `products.json` or AlloyDB
- **Product Data Model**: ID, name, description, picture, price_usd, categories (repeated array)
- **Current Filtering**: `SearchProducts` RPC searches by name/description only; no category or price filtering
- **Frontend Display**: Server-side rendered; all products displayed on home page
- **No Pagination**: All products loaded at once
- **No Sorting**: Products displayed in catalog order
- **No Filter UI**: Sidebar or filter controls don't exist

### Proposed Changes

1. **Extend ProductCatalogService** (Go, gRPC)
   - New RPC method: `GetProductsWithFilters(GetProductsWithFiltersRequest) → ProductsResponse`
   - Request parameters:
     - `categories` (repeated string, OR logic)
     - `min_price` (int64 cents, optional)
     - `max_price` (int64 cents, optional)
     - `sort_by` (enum: relevance, price_asc, price_desc, name_asc, name_desc)
     - `offset` (pagination)
     - `limit` (pagination)
   - Response: Products list + total count + filter metadata (available categories, price range)
   - Filtering logic: 
     - Categories: product.categories contains ANY of requested categories (OR logic)
     - Price: product.price_usd between min_price and max_price
     - Sorting: applied after filtering
     - Pagination: offset/limit for large result sets

2. **Frontend Handler Updates** (Go HTTP)
   - Modify `homeHandler`:
     - Parse filter parameters from URL query string (category, minPrice, maxPrice, sort)
     - Call new `GetProductsWithFilters` RPC with parameters
     - Pass available categories and price range to template for filter UI
   - Create new `FilterProductsHandler` (optional): 
     - AJAX endpoint for dynamic filter updates (if real-time filtering needed)
     - Returns JSON for dynamic updates without page reload

3. **Frontend Template Updates** (Go templates + minimal JS)
   - Add filter sidebar/panel to `home.html`:
     - Category checkboxes (generated from available categories)
     - Price range inputs or sliders (dual slider with min/max)
     - Sort dropdown
     - "Clear All" and "Apply Filters" buttons
   - Display filter chips above product grid:
     - Show active filters as removable tags
     - Click X on tag to remove that filter
   - Update product count display
   - Empty state template for no results
   - Mobile-friendly collapsible filter panel

4. **URL Parameter Handling**
   - Query parameters: `?category=accessories&category=kitchen&minPrice=20&maxPrice=100&sort=price_asc`
   - Client-side JavaScript (minimal):
     - Populate filter inputs from URL on page load
     - Update URL as filters change (history.replaceState)
     - Preserve scroll position when filtering
   - Server-side: Render filters based on URL params

5. **Proto Definition Updates** (`protos/demo.proto`)
   - New request message: `GetProductsWithFiltersRequest`
     - `repeated string categories`
     - `int64 min_price` (optional, in cents)
     - `int64 max_price` (optional, in cents)
     - `string sort_by` (enum: relevance, price_asc, price_desc, name_asc, name_desc)
     - `int32 offset` (pagination)
     - `int32 limit` (pagination)
   - New response message: `ProductsResponse`
     - `repeated Product products`
     - `int32 total_count` (total products matching filter, for pagination UI)
     - `repeated string available_categories` (for filter UI)
     - `int64 min_price_in_catalog` (for price slider bounds)
     - `int64 max_price_in_catalog` (for price slider bounds)

### Technical Constraints

- **Stateless Filtering**: All filter state in URL parameters (no session storage)
- **Server-Side Rendering**: Filters applied server-side, not client-side (initially)
- **Price in USD**: All prices stored in USD; conversion happens in template rendering
- **OR Logic for Categories**: Selecting multiple categories shows products in ANY category (not ALL)
- **Performance**: Must handle filtering in < 200ms even with 1000+ products
- **Backward Compatibility**: Existing `/` endpoint should still work without filters

### Integration Points

1. **Frontend Service** ↔ **ProductCatalogService**: New RPC call `GetProductsWithFilters`
2. **Frontend Handlers**: Parse URL query parameters and pass to ProductCatalogService
3. **Frontend Templates**: Render filter UI and apply CSS classes for filter state
4. **CurrencyService**: Price display conversion (existing, unchanged)

### Architecture Decisions

| Decision                           | Rationale                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Server-Side Filtering**          | Simpler MVP; reduces complexity vs. client-side filtering with large datasets.                            |
| **New RPC Endpoint**               | Keeps existing `ListProducts` unchanged for backward compatibility; clear separation of concerns.         |
| **URL Parameters for State**       | Enables bookmarkable/shareable URLs; no session state needed; works across browser tabs.                 |
| **OR Logic for Categories**        | More intuitive for users; matches expected filtering behavior ("show me accessories OR kitchen").        |
| **Pagination Support**             | Future-proofs for large catalogs; prevents loading massive result sets.                                  |
| **Price in Cents (int64)**         | Avoids floating-point precision issues; standard e-commerce practice.                                    |
| **Available Filters in Response**  | Allows dynamic UI generation; categories/price bounds change as catalog grows.                          |

---

## 🚫 Out of Scope

1. **Advanced Search Operators** (e.g., "price < 50 AND category = kitchen") — Use simple UI only
2. **Search Text with Filters** — Focus on categorical/price filtering; can add search later
3. **Filter Presets** ("Under $25", "Budget Electronics") — Not in MVP
4. **Filter History/Recommendations** — No ML-based suggestions
5. **Faceted Search Analytics** — Don't track filter usage
6. **Bulk Product Updates** — Catalog updates still via file/DB reload
7. **Dynamic Category Creation** — Categories pre-defined
8. **Real-Time Inventory** — Stock levels not tracked
9. **Filter Persistence to User Account** — Filters reset when session ends
10. **Advanced Sorting** (popularity, rating, newest) — Only price/name for now

**Future Considerations**:
- Add text search alongside category/price filters
- Implement filter presets for common queries
- Build filter analytics to identify popular filter combinations
- Add more granular sorting (relevance, popularity, newest)
- Support advanced filter operators for power users
- Cache filtered result sets for performance

---

## ⚠️ Edge Cases & Error Handling

### Edge Cases

1. **No categories exist in catalog**
   - **Handling**: Don't show category filter; show message "No categories available"

2. **All products same price**
   - **Handling**: Show price range with single value; still functional

3. **Very high price product (e.g., $10,000)**
   - **Handling**: Price slider accommodates full range; use logarithmic scale if needed

4. **Product with multiple categories selected, filtering shows it twice**
   - **Handling**: Product appears once in results; filtering logic uses `OR` across categories

5. **User applies filters with no results**
   - **Handling**: Show empty state with "Clear filters" button and category suggestions

6. **URL contains invalid filter values**
   - **Handling**: Ignore invalid params; apply only valid ones; redirect to clean URL

7. **Very large price range (e.g., 0 to 999,999)**
   - **Handling**: Slider still functional; UX may degrade with extreme ranges; consider setting reasonable bounds

8. **User sorts by price, multiple products same price**
   - **Handling**: Maintain catalog order as secondary sort; results deterministic

### Error Scenarios

| Error Condition                          | User Message                                                  | System Behavior                                   |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| ProductCatalogService unavailable        | "Unable to load products. Please try again later."            | Show error; log incident; allow retry            |
| Invalid filter parameters in URL         | (No error shown; invalid params silently ignored)             | Apply valid params; redirect to clean URL        |
| Price range inverted (min > max)         | Automatically swap min and max values                         | Correct automatically; proceed with filtering    |
| Filtering returns 0 products             | "No products found matching your filters"                     | Show empty state; suggest clearing filters       |
| Slow database query (> 5s)               | "Your search took too long. Please try again."                | Timeout; log slow query; suggest simpler filters |
| Category doesn't exist in filter request | Silently skip non-existent category                           | Filter by valid categories only                  |

### Data Validation Rules

- **Categories**: String array, each 1-50 characters, alphanumeric + hyphens/underscores
- **Min Price**: Integer ≥ 0 (in cents)
- **Max Price**: Integer ≥ min_price (in cents)
- **Sort By**: Enum: `relevance`, `price_asc`, `price_desc`, `name_asc`, `name_desc`
- **Offset**: Integer ≥ 0
- **Limit**: Integer 1-100 (default 20)
- **Product ID**: String, 1-50 characters (from catalog)

---

## 📦 Dependencies

### Blocking

- [ ] None — Can be developed independently

### Related

- **SCRUM-2** — Order History (may display purchased product categories)
- **SCRUM-1** — Wishlist (can use same filter UI for wishlist filtering in future)

### Infrastructure

- **gRPC**: Already available
- **Go templates**: Already available
- **CurrencyService**: Already integrated for price display
- **ProductCatalogService**: Existing, will be extended

---

## 🎓 Definition of Done

### Code Quality

- [ ] Unit test coverage ≥ 80% (filtering logic)
- [ ] No hardcoded filter values; use configuration
- [ ] Code follows project conventions
- [ ] Proto definitions documented
- [ ] Filter validation on both frontend and backend
- [ ] Proper error handling for edge cases
- [ ] Performance: Filtering 1000+ products in < 200ms

### Testing

- [ ] All 10 BDD scenarios automated
- [ ] Single category filter works
- [ ] Multiple category filters (OR logic)
- [ ] Price range filtering (min/max combinations)
- [ ] Combined category + price filters
- [ ] All sorting options work correctly
- [ ] URL parameter parsing (valid and invalid)
- [ ] Empty state rendering
- [ ] Filter chips display and remove correctly
- [ ] Mobile responsive filter UI
- [ ] Performance test: 1000+ products with complex filters
- [ ] Edge cases: invalid params, no results, price inversions

### Documentation

- [ ] Proto definitions documented
- [ ] RPC endpoint documented (parameters, response format)
- [ ] Filter logic documented (OR vs AND, price range handling)
- [ ] URL parameter format documented (for sharing/bookmarking)
- [ ] Frontend component documentation (filter UI, filter chips)
- [ ] Sorting algorithm documentation
- [ ] Pagination limits documented

### Review & Deployment

- [ ] Code reviewed and approved (1+ reviewer)
- [ ] All CI checks passing
- [ ] PR merged to main
- [ ] Feature flag: Filters enabled by default
- [ ] Monitoring: Filter query latency tracked (target: < 200ms)

### Infrastructure

- [ ] ProductCatalogService updated and deployed
- [ ] New RPC endpoint tested with various filter combinations
- [ ] Traces exported for performance monitoring

---

## 📝 Implementation Notes

**For Backend Engineer (ProductCatalogService)**:
- Create new RPC method `GetProductsWithFilters` with filtering logic
- Implement category filtering with OR logic (product.categories contains ANY of request.categories)
- Implement price range filtering (min_price <= product.price <= max_price)
- Implement sorting: price_asc, price_desc, name_asc, name_desc, relevance (catalog order)
- Add pagination: offset/limit parameters in request
- Return metadata: total_count, available_categories, min/max price in catalog
- Ensure filtering completes in < 200ms even with 1000+ products
- Consider caching filter metadata (available categories, price bounds)

**For Frontend Engineer**:
- Parse URL query parameters on page load (category, minPrice, maxPrice, sort)
- Render filter sidebar/panel with:
  - Category checkboxes (dynamically generated from available_categories)
  - Price range dual-slider or min/max input fields
  - Sort dropdown
  - "Clear All" button
- Render filter chips above product list (removable tags)
- Update product grid with filtered results
- Update product count
- Update URL query parameters as filters change (history.replaceState)
- Handle mobile view: collapsible filter panel
- Show empty state when no results
- Add minimal JavaScript for real-time filter updates (debounced)

**For QA Engineer**:
- Test single category filter: select each category, verify only matching products shown
- Test multiple categories: select 2-3 categories, verify OR logic (union, not intersection)
- Test price range: various min/max combinations, boundary values ($0, $100+)
- Test sort: all 5 sort options, verify order is correct
- Test filter combinations: category + price + sort together
- Test URL parameters: bookmarking, sharing, manual URL editing
- Test empty state: apply filters that match no products
- Test filter removal: individual chip removal, clear all button
- Test mobile UI: filter panel collapse/expand on small screens
- Test performance: filter 1000+ products, measure response time
- Test edge cases: invalid params, price inversion, non-existent category

**Known Gotchas**:
- **OR vs AND Logic**: Users intuitively expect "Accessories OR Kitchen" (union), not intersection. Implement accordingly.
- **Price in Cents**: Store as int64 cents internally, convert to dollars for display (e.g., 1999 cents = $19.99)
- **URL Encoding**: Multiple category params need proper URL encoding: `?category=accessories&category=kitchen`
- **Pagination Offset**: When applying new filters, reset offset to 0 (don't keep old pagination offset)
- **Case Sensitivity**: Category matching should be case-insensitive or standardized (e.g., all lowercase)
- **Floating-Point Prices**: If prices stored as floats, may have precision issues; ensure consistent rounding

---

## 🔗 References

- **Product Catalog Service**: `src/productcatalogservice/product_catalog.go`
- **Catalog Loader**: `src/productcatalogservice/catalog_loader.go`
- **Products Data**: `src/productcatalogservice/products.json`
- **Frontend Handlers**: `src/frontend/handlers.go` (homeHandler)
- **Frontend RPC**: `src/frontend/rpc.go` (getProducts)
- **Proto Definitions**: `protos/demo.proto` (Product, Money messages)
- **Home Template**: `src/frontend/templates/home.html`
- **Product Template**: `src/frontend/templates/product.html`

---

**Metadata**:
- **Created**: 2026-04-14
- **Created By**: Claude SDD Generator (from input: "Agregar filtros por precio y categoría en el catálogo")
- **INVEST Validated**: ✅ (All criteria met; estimated 6-8 days)
- **BDD Scenarios**: 10 (comprehensive: single/multiple filters, sorting, URL persistence, performance, edge cases)
- **Priority**: High (critical UX feature for product discovery)
- **Labels**: `feature`, `sdd`, `microservices`, `frontend`, `backend`
- **Complexity**: Medium (extends existing service, UI component, URL parameter handling)
