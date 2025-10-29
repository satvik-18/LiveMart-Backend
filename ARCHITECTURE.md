# System Architecture Diagram

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS TABLE                              │
│  id | name | email | password | role | created_at               │
│  (role: 'customer' | 'retailer' | 'wholesaler')                 │
└──────────┬────────────────────────────┬─────────────────────────┘
           │                            │
           │                            │
    ┌──────▼──────┐            ┌────────▼────────┐
    │  PRODUCTS   │            │     ORDERS      │
    │  - seller_id├────────┐   │  - buyer_id     │
    │  - name     │        │   │  - seller_id    │
    │  - price    │        │   │  - product_id   │
    │  - category │        │   │  - quantity     │
    │  - desc     │        │   │  - total_amount │
    └──────┬──────┘        │   │  - order_type   │
           │               │   └─────────────────┘
           │               │
           ├───────────────┴────────────────┐
           │                                │
    ┌──────▼──────────────┐        ┌───────▼─────────────┐
    │ RETAILER_INVENTORY  │        │ WHOLESALER_INVENTORY│
    │  - retailer_id      │        │  - wholesaler_id    │
    │  - product_id       │        │  - product_id       │
    │  - quantity_in_stock│        │  - quantity_in_stock│
    │  - reorder_level    │        │  - min_order_qty    │
    │  - last_restocked   │        │  - last_restocked   │
    └─────────────────────┘        └─────────────────────┘
```

## Supply Chain Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LIVEMART SUPPLY CHAIN                         │
└─────────────────────────────────────────────────────────────────┘

    WHOLESALERS                RETAILERS                CUSTOMERS
    ───────────                ─────────                ─────────
         │                         │                        │
         │ ┌──────────────────┐   │                        │
         │ │ Add Products     │   │                        │
         │ │ Set Min Qty (≥10)│   │                        │
         │ └──────────────────┘   │                        │
         │                         │                        │
         │   Bulk Orders (50+)     │                        │
         ├────────────────────────►│                        │
         │   Payment              ┌┴───────────────────┐   │
         │◄────────────────────────┤ Add to Inventory  │   │
         │                         │ Set Reorder Level │   │
         │                         └───────────────────┘   │
         │                         │                        │
         │                         │  ┌──────────────────┐ │
         │                         │  │ Add Products     │ │
         │                         │  │ (from inventory) │ │
         │                         │  └──────────────────┘ │
         │                         │                        │
         │                         │   Retail Orders        │
         │                         ├───────────────────────►│
         │                         │   Payment              │
         │                         │◄───────────────────────┤
         │                         │                        │
         │                         │  ┌──────────────────┐ │
         │                         │  │ Stock Deducted   │ │
         │                         │  │ Check Reorder    │ │
         │                         │  └──────────────────┘ │
         ▼                         ▼                        ▼

   CANNOT BUY              CAN BUY & SELL            CAN ONLY BUY
   ONLY SELLS              BULK → RETAIL             FROM RETAILERS
```

## API Request Flow

```
┌────────────┐
│   CLIENT   │
└─────┬──────┘
      │
      │ 1. Request + JWT Token
      ▼
┌─────────────────┐
│  authMiddleware │ ──► Verify JWT
└─────┬───────────┘     Extract user info
      │
      │ 2. User { id, email, role }
      ▼
┌─────────────────┐
│  Route Handler  │
│   (Role Check)  │ ──► wholesaler → wholesalers.js
└─────┬───────────┘     retailer → retailers.js
      │                 customer → customers.js
      │ 3. Database Query
      ▼
┌─────────────────┐
│   PostgreSQL    │
│  (with Indexes) │ ──► Fast lookups
└─────┬───────────┘     JOIN operations
      │
      │ 4. Query Result
      ▼
┌─────────────────┐
│  JSON Response  │
│   to Client     │
└─────────────────┘
```

## Order Placement Flow (Retailer → Wholesaler)

```
START
  │
  ▼
┌──────────────────────┐
│ POST /retailers/     │
│  order/wholesale     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Validate JWT Token   │
│ Check role=retailer  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ BEGIN TRANSACTION    │
└──────┬───────────────┘
       │
       ▼ (for each product)
┌──────────────────────────────────┐
│ 1. Verify seller is wholesaler   │
│ 2. Check stock availability      │
│ 3. Validate minimum order qty    │  ◄── BUSINESS LOGIC
│    quantity >= min_order_qty     │
└──────┬───────────────────────────┘
       │
       │ ✅ All validations pass
       ▼
┌──────────────────────────────────┐
│ Update wholesaler_inventory:     │
│  quantity_in_stock -= ordered    │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Update retailer_inventory:       │
│  quantity_in_stock += ordered    │
│  (UPSERT if not exists)          │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Insert into orders table:        │
│  order_type = 'wholesale'        │
│  status = 'pending'              │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────┐
│ COMMIT TRANSACTION   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Return success with  │
│ order details        │
└──────────────────────┘
  END

❌ If any step fails:
   ROLLBACK TRANSACTION
   Return error message
```

## Inventory Update Flow

```
CUSTOMER ORDERS FROM RETAILER
         │
         ▼
┌─────────────────────────────┐
│ Check retailer_inventory    │
│ for stock availability      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Deduct from                 │
│ retailer_inventory          │
│ quantity_in_stock           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Check if stock <=           │
│ reorder_level               │
└──────────┬──────────────────┘
           │
           ▼ (if low)
┌─────────────────────────────┐
│ Add to low_stock_alerts     │
│ Notify retailer             │
└─────────────────────────────┘
```

## Role-Based Product Visibility

```
┌─────────────────────────────────────────────────────┐
│              GET /products/all                      │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
         Check User Role
               │
       ┌───────┴────────┬──────────────┐
       │                │              │
   CUSTOMER        RETAILER      WHOLESALER
       │                │              │
       ▼                ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌────────────┐
│ See only    │  │ See only    │  │ See all    │
│ RETAILER    │  │ WHOLESALER  │  │ products   │
│ products    │  │ products    │  │ (reference)│
└─────────────┘  └─────────────┘  └────────────┘
```

## Data Consistency Guarantees

```
┌────────────────────────────────────────────────┐
│         ACID Transaction Properties             │
└────────────────────────────────────────────────┘

ATOMICITY
  ├─ Product + Inventory created together
  ├─ Order + Stock updates happen together
  └─ All or nothing (ROLLBACK on error)

CONSISTENCY
  ├─ Foreign key constraints enforced
  ├─ CHECK constraints (qty >= 0, rating 1-5)
  └─ UNIQUE constraints (no duplicate inventory)

ISOLATION
  ├─ Concurrent orders don't oversell
  └─ Transactions don't interfere

DURABILITY
  └─ Committed changes persist
```

## Performance Optimization

```
┌────────────────────────────────────────────────┐
│            OPTIMIZATION LAYERS                  │
└────────────────────────────────────────────────┘

1. DATABASE LEVEL
   ├─ Indexes on foreign keys
   ├─ Optimized JOIN queries
   └─ UNIQUE constraints prevent duplicates

2. APPLICATION LEVEL
   ├─ Single query vs multiple round trips
   ├─ Role-based filtering in SQL
   └─ Parameterized queries (prepared statements)

3. BUSINESS LOGIC
   ├─ Early validation before transactions
   ├─ Efficient error handling
   └─ Minimal database locks
```

## Security Layers

```
┌────────────────────────────────────────────────┐
│           SECURITY ARCHITECTURE                 │
└────────────────────────────────────────────────┘

LAYER 1: Authentication
  └─ JWT Token verification

LAYER 2: Authorization
  └─ Role-based access control (RBAC)

LAYER 3: Ownership
  └─ Users can only modify their own data

LAYER 4: Input Validation
  └─ Check required fields, types, ranges

LAYER 5: Database
  └─ Parameterized queries (SQL injection prevention)
  └─ Foreign key constraints
  └─ CHECK constraints

LAYER 6: Transaction Safety
  └─ ROLLBACK on any error
  └─ Consistent state guaranteed
```

This architecture ensures:
✅ Data integrity
✅ Business logic enforcement
✅ Security
✅ Performance
✅ Scalability
