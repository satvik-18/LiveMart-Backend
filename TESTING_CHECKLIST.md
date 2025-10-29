# Testing Checklist - Inventory Management System

## Pre-Test Setup

### ✅ Environment Setup
- [ ] Database is running (PostgreSQL)
- [ ] Redis is running
- [ ] `.env` file configured with correct credentials
- [ ] Dependencies installed (`npm install`)
- [ ] Database initialized (`node src/scripts/initDB.js`)
- [ ] Server running (`npm start`)

### ✅ Test Users Created
Create one user for each role:
- [ ] Wholesaler account (email, token saved)
- [ ] Retailer account (email, token saved)
- [ ] Customer account (email, token saved)

---

## 1. Database Schema Tests

### ✅ Tables Created
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```
- [ ] `users` table exists
- [ ] `products` table exists
- [ ] `retailer_inventory` table exists
- [ ] `wholesaler_inventory` table exists
- [ ] `orders` table exists
- [ ] `wishlists` table exists
- [ ] `reviews` table exists

### ✅ Indexes Created
```sql
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public';
```
- [ ] idx_products_seller
- [ ] idx_products_category
- [ ] idx_retailer_inventory_retailer
- [ ] idx_retailer_inventory_product
- [ ] idx_wholesaler_inventory_wholesaler
- [ ] idx_wholesaler_inventory_product
- [ ] idx_orders_buyer
- [ ] idx_orders_seller
- [ ] idx_orders_product

### ✅ Constraints
- [ ] retailer_inventory has UNIQUE(retailer_id, product_id)
- [ ] wholesaler_inventory has UNIQUE(wholesaler_id, product_id)
- [ ] wholesaler_inventory.minimum_order_quantity CHECK >= 10
- [ ] products.seller_id is FOREIGN KEY to users.id

---

## 2. Wholesaler Flow Tests

### ✅ Product Management
- [ ] Add product with valid data (min_qty = 50)
  - Expected: 201 Created, product + inventory entry
- [ ] Add product with low min_qty (< 10)
  - Expected: 400 Error, "cannot be less than 10 units"
- [ ] View inventory
  - Expected: 200 OK, list of products with stock
- [ ] Update product details (name, price)
  - Expected: 200 OK, product updated
- [ ] Update inventory (stock, min_qty)
  - Expected: 200 OK, inventory updated
- [ ] Restock inventory (+100 units)
  - Expected: 200 OK, stock increased
- [ ] Delete own product
  - Expected: 200 OK, product deleted
- [ ] Try to delete other's product
  - Expected: 404 Not found or unauthorized

### ✅ Sales Tracking
- [ ] View sales orders (after retailer orders)
  - Expected: 200 OK, list of orders from retailers
- [ ] Get sales analytics
  - Expected: 200 OK, summary stats + top products
- [ ] Update order status (pending → shipped)
  - Expected: 200 OK, status updated
- [ ] Update order status (shipped → delivered)
  - Expected: 200 OK, status updated

### ✅ Business Logic
- [ ] Wholesaler tries to place order
  - Expected: 403 Forbidden, "suppliers only"
- [ ] Wholesaler tries to view customer products
  - Expected: Empty or filtered list

---

## 3. Retailer Flow Tests

### ✅ Product Management
- [ ] Add product with valid data (reorder_level = 10)
  - Expected: 201 Created, product + inventory entry
- [ ] View inventory
  - Expected: 200 OK, list with needs_restock flag
- [ ] Update inventory (stock, reorder_level)
  - Expected: 200 OK, inventory updated
- [ ] Restock inventory manually
  - Expected: 200 OK, stock increased
- [ ] Get low stock alerts (set stock < reorder_level)
  - Expected: 200 OK, products below threshold
- [ ] View own products
  - Expected: 200 OK, products with stock info

### ✅ Wholesale Ordering
- [ ] View wholesaler products
  - Expected: 200 OK, only wholesaler products shown
- [ ] Order from wholesaler (quantity >= min_qty)
  - Expected: 201 Created, order placed
  - Verify: wholesaler stock decreased
  - Verify: retailer inventory increased
  - Verify: order record created
- [ ] Order from wholesaler (quantity < min_qty)
  - Expected: 400 Error, "minimum order of X units"
- [ ] Order with insufficient wholesaler stock
  - Expected: 400 Error, "insufficient stock"
- [ ] Order from non-existent wholesaler
  - Expected: 400 Error, "not a wholesaler"

### ✅ Sales Tracking
- [ ] View purchase orders (from wholesalers)
  - Expected: 200 OK, wholesale order history
- [ ] View sales (to customers)
  - Expected: 200 OK, retail order history

### ✅ Business Logic
- [ ] Retailer tries to buy from customer
  - Expected: 403 or filtered out
- [ ] Retailer tries to order from self
  - Expected: 400 Error, "cannot order from yourself"

---

## 4. Customer Flow Tests

### ✅ Product Browsing
- [ ] View available products
  - Expected: 200 OK, only retailer products with stock > 0
- [ ] View product details
  - Expected: 200 OK, product info with stock

### ✅ Order Placement
- [ ] Place order with valid quantity
  - Expected: 201 Created, order placed
  - Verify: retailer stock decreased
  - Verify: order record created
- [ ] Place order with quantity > stock
  - Expected: 400 Error, "insufficient stock"
- [ ] Place order with delivery details
  - Expected: 201 Created, details saved
- [ ] Place order with expected delivery date
  - Expected: 201 Created, date saved

### ✅ Order History
- [ ] View own orders
  - Expected: 200 OK, formatted order list
- [ ] Try to view other customer's orders
  - Expected: 403 Forbidden

### ✅ Business Logic
- [ ] Customer tries to add product
  - Expected: 403 Forbidden, "customers cannot add products"
- [ ] Customer tries to order from wholesaler
  - Expected: No wholesaler products visible
- [ ] Customer tries to order from self
  - Expected: 400 Error (if somehow possible)

---

## 5. Integration Tests

### ✅ Complete Supply Chain Flow
1. [ ] Wholesaler adds product (stock = 1000, min_qty = 50)
2. [ ] Retailer views wholesaler products
3. [ ] Retailer orders 100 units
4. [ ] Verify wholesaler stock = 900
5. [ ] Verify retailer inventory = 100
6. [ ] Retailer adds retail product (stock from inventory)
7. [ ] Customer views retailer products
8. [ ] Customer orders 10 units
9. [ ] Verify retailer stock = 90
10. [ ] Check if low stock alert triggered (if reorder_level > 90)

### ✅ Concurrent Operations
- [ ] Two retailers order same product simultaneously
  - Expected: Both succeed, stock correctly deducted
- [ ] Multiple customers order same product
  - Expected: Orders processed, no overselling

### ✅ Transaction Rollback
- [ ] Start order with invalid data mid-transaction
  - Expected: Transaction rolled back, stock unchanged
- [ ] Network error during order
  - Expected: No partial updates

---

## 6. Edge Cases

### ✅ Boundary Values
- [ ] Add product with stock = 0
  - Expected: Allowed
- [ ] Add product with min_qty = 10 (exact minimum)
  - Expected: Allowed
- [ ] Add product with min_qty = 9
  - Expected: 400 Error
- [ ] Order exactly min_qty
  - Expected: Allowed
- [ ] Order min_qty - 1
  - Expected: 400 Error

### ✅ Null/Missing Values
- [ ] Add product without category
  - Expected: Allowed (nullable)
- [ ] Add product without initial_stock
  - Expected: 400 Error (required)
- [ ] Update inventory with null values
  - Expected: Fields unchanged (COALESCE)

### ✅ Data Validation
- [ ] Add product with negative price
  - Expected: 400 Error or DB constraint violation
- [ ] Add product with negative stock
  - Expected: 400 Error
- [ ] Set reorder_level to negative
  - Expected: 400 Error

---

## 7. Security Tests

### ✅ Authentication
- [ ] Access endpoint without token
  - Expected: 401 Unauthorized
- [ ] Access endpoint with invalid token
  - Expected: 401 Unauthorized
- [ ] Access endpoint with expired token
  - Expected: 401 Unauthorized

### ✅ Authorization
- [ ] Customer tries to access /wholesalers/inventory
  - Expected: 403 Forbidden
- [ ] Retailer tries to access /wholesalers/analytics
  - Expected: 403 Forbidden
- [ ] Wholesaler tries to access /customers/placeorder
  - Expected: 403 Forbidden

### ✅ Ownership
- [ ] User A tries to update User B's product
  - Expected: 404 or unauthorized
- [ ] User A tries to delete User B's inventory
  - Expected: 404 or unauthorized

### ✅ SQL Injection
- [ ] Send SQL in product name: `'; DROP TABLE products; --`
  - Expected: Name saved as string, no DB damage
- [ ] Send SQL in query params
  - Expected: Treated as string, parameterized query safe

---

## 8. Performance Tests

### ✅ Query Performance
- [ ] GET /products/all with 1000+ products
  - Expected: < 100ms (with indexes)
- [ ] GET /retailers/inventory with 500+ items
  - Expected: < 50ms
- [ ] Complex JOIN query for orders
  - Expected: < 100ms

### ✅ Concurrent Load
- [ ] 10 simultaneous orders
  - Expected: All process correctly
- [ ] 50 product additions
  - Expected: All complete without errors

---

## 9. Error Handling Tests

### ✅ Database Errors
- [ ] Connection lost during transaction
  - Expected: Graceful error message
- [ ] Constraint violation
  - Expected: Specific error message
- [ ] Foreign key violation
  - Expected: Clear error message

### ✅ Input Validation
- [ ] Missing required fields
  - Expected: 400 Bad Request with field names
- [ ] Invalid data types
  - Expected: 400 Bad Request
- [ ] Out of range values
  - Expected: 400 Bad Request

---

## 10. API Response Tests

### ✅ Response Format
- [ ] Successful request returns expected structure
- [ ] Error returns {message: "..."}
- [ ] List endpoints return arrays
- [ ] Detail endpoints return objects

### ✅ Status Codes
- [ ] 200 OK for successful GET/PATCH
- [ ] 201 Created for successful POST
- [ ] 400 Bad Request for invalid input
- [ ] 401 Unauthorized for missing/invalid token
- [ ] 403 Forbidden for role mismatch
- [ ] 404 Not Found for missing resources
- [ ] 500 Internal Server Error for unexpected errors

---

## Summary

### Test Results
```
Total Tests: ~150
Passed: ___
Failed: ___
Skipped: ___

Pass Rate: ___%
```

### Issues Found
1. 
2. 
3. 

### Notes
- 
- 
- 

### Sign-off
Tested by: ________________
Date: ____________________
Status: ☐ Passed  ☐ Failed  ☐ Needs Review
