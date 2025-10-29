# Database Migration Guide - Inventory System Implementation

## Overview
This guide explains how to migrate from the old product-based stock system to the new inventory management system with separate tables for retailers and wholesalers.

## What Changed

### Database Schema Changes

#### 1. **Products Table**
**Before:**
- Had `stock` column (managed in products table)
- Had `product_type` column ('retail' or 'wholesale')
- Had `seller` VARCHAR field (seller name)

**After:**
- Removed `stock` column (now in inventory tables)
- Removed `product_type` column (determined by seller role)
- Changed to `seller_id` INTEGER (foreign key to users table)
- Added `category` field
- Added `updated_at` timestamp

#### 2. **Orders Table**
**Before:**
- Had `customer_id` field
- Simple structure

**After:**
- Changed `customer_id` to `buyer_id` (more generic)
- Added `total_amount` field
- Added `order_type` ('retail' or 'wholesale')
- More comprehensive tracking

#### 3. **New Tables Added**

**retailer_inventory:**
- Tracks stock for each retailer's products
- Includes `reorder_level` for low-stock alerts
- Unique constraint on (retailer_id, product_id)

**wholesaler_inventory:**
- Tracks stock for each wholesaler's products
- Includes `minimum_order_quantity` for bulk enforcement
- Unique constraint on (wholesaler_id, product_id)

## Migration Steps

### Step 1: Backup Your Database
```sql
-- PostgreSQL backup command
pg_dump -h localhost -U your_user -d livemart > backup_before_migration.sql
```

### Step 2: Run the Migration Script

```bash
# Navigate to your project
cd c:\Users\Shauryearaj\Backend\LiveMart-Backend

# Run the database initialization
node src/scripts/initDB.js
```

The `initDB.js` script will:
1. Create new inventory tables
2. Add missing columns to existing tables
3. Create indexes for performance

### Step 3: Data Migration (If You Have Existing Data)

If you have existing products in the old schema, run this migration:

```sql
-- 1. Update products table to use seller_id instead of seller name
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id INTEGER;

-- 2. Migrate seller names to seller_id (match with users table)
UPDATE products p
SET seller_id = u.id
FROM users u
WHERE p.seller = u.name;

-- 3. Migrate existing product stock to inventory tables

-- For retail products (sellers who are retailers)
INSERT INTO retailer_inventory (retailer_id, product_id, quantity_in_stock, reorder_level)
SELECT 
    p.seller_id,
    p.id,
    p.stock,
    10 -- default reorder level
FROM products p
JOIN users u ON p.seller_id = u.id
WHERE u.role = 'retailer' AND p.stock IS NOT NULL
ON CONFLICT (retailer_id, product_id) DO NOTHING;

-- For wholesale products (sellers who are wholesalers)
INSERT INTO wholesaler_inventory (wholesaler_id, product_id, quantity_in_stock, minimum_order_quantity)
SELECT 
    p.seller_id,
    p.id,
    p.stock,
    25 -- default minimum order quantity
FROM products p
JOIN users u ON p.seller_id = u.id
WHERE u.role = 'wholesaler' AND p.stock IS NOT NULL
ON CONFLICT (wholesaler_id, product_id) DO NOTHING;

-- 4. Update orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_id INTEGER;
UPDATE orders SET buyer_id = customer_id WHERE buyer_id IS NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(50);
UPDATE orders o
SET order_type = CASE 
    WHEN EXISTS (
        SELECT 1 FROM users 
        WHERE id = o.customer_id AND role = 'customer'
    ) THEN 'retail'
    ELSE 'wholesale'
END
WHERE order_type IS NULL;

-- 5. Drop old columns (ONLY after verifying migration worked)
-- ALTER TABLE products DROP COLUMN IF EXISTS stock;
-- ALTER TABLE products DROP COLUMN IF EXISTS product_type;
-- ALTER TABLE products DROP COLUMN IF EXISTS seller;
```

### Step 4: Update Your Application

1. **Install dependencies** (if any new ones were added)
```bash
npm install
```

2. **Restart your server**
```bash
npm start
```

## API Changes

### Product Routes

**Before:**
```http
POST /products/products
{
  "name": "Product",
  "price": 100,
  "stock": 50,
  "product_type": "retail"
}
```

**After:**
```http
POST /products/add
{
  "name": "Product",
  "price": 100,
  "initial_stock": 50,
  "category": "Electronics",
  "reorder_level": 10  // for retailers
  // OR
  "minimum_order_quantity": 25  // for wholesalers
}
```

### New Endpoints Available

#### For Retailers:
- `GET /retailers/inventory` - View inventory
- `PATCH /retailers/inventory/update/:productId` - Update stock/reorder level
- `POST /retailers/inventory/restock/:productId` - Add stock
- `GET /retailers/inventory/low-stock` - Get low stock alerts
- `POST /retailers/order/wholesale` - Order from wholesalers
- `GET /retailers/orders/purchases` - View purchase orders
- `GET /retailers/orders/sales` - View sales to customers

#### For Wholesalers:
- `GET /wholesalers/inventory` - View inventory
- `PATCH /wholesalers/inventory/update/:productId` - Update stock/minimum order
- `POST /wholesalers/inventory/restock/:productId` - Add stock
- `GET /wholesalers/orders/sales` - View sales to retailers
- `GET /wholesalers/analytics/sales` - Get sales analytics
- `PATCH /wholesalers/orders/:orderId/status` - Update order status

## Testing

Use the provided REST files:
- `src/REST-apis/products-updated.REST`
- `src/REST-apis/retailers.REST`
- `src/REST-apis/wholesalers.REST`

## Rollback Plan

If something goes wrong:

```sql
-- Restore from backup
psql -h localhost -U your_user -d livemart < backup_before_migration.sql
```

## Verification Checklist

- [ ] Database tables created successfully
- [ ] Existing data migrated to inventory tables
- [ ] Products have correct seller_id references
- [ ] Orders have buyer_id and order_type set
- [ ] Indexes created for performance
- [ ] Server starts without errors
- [ ] Can add products as retailer
- [ ] Can add products as wholesaler
- [ ] Retailers can order from wholesalers with minimum quantity validation
- [ ] Customers can order from retailers
- [ ] Inventory updates correctly on orders
- [ ] Low stock alerts work for retailers
- [ ] Sales analytics work for wholesalers

## Constants Configuration

Business rules are defined in `src/config/constants.js`:

```javascript
ABSOLUTE_WHOLESALE_MINIMUM = 10  // Platform minimum for bulk orders
DEFAULT_WHOLESALE_MINIMUM = 25   // Suggested default
DEFAULT_REORDER_LEVEL = 10       // Default low-stock threshold
```

Adjust these values based on your business needs.

## Support

If you encounter issues during migration:
1. Check server logs for errors
2. Verify database connections
3. Ensure all foreign key relationships are valid
4. Check that user roles are set correctly

## Notes

- The old `products.REST` file is kept for reference
- Use `products-updated.REST` for new API structure
- All routes now use proper role-based access control
- Stock is managed separately for each seller
- Bulk order minimums are enforced at the platform level
