# Quick Start Guide - Inventory System

## 🚀 Getting Started

### 1. Initialize Database
```bash
node src/scripts/initDB.js
```

This will:
- Create new inventory tables
- Add missing columns
- Create performance indexes

### 2. Start Server
```bash
npm start
```

Server will run on `http://localhost:3000`

## 📝 Testing the Implementation

### Step 1: Create Users (if not exists)

Use the auth endpoints to create test users:

```http
# Register Wholesaler
POST http://localhost:3000/auth/signup
Content-Type: application/json

{
  "email": "wholesaler@test.com",
  "password": "password123"
}

# Verify OTP
POST http://localhost:3000/auth/verify-otp
Content-Type: application/json

{
  "email": "wholesaler@test.com",
  "name": "Big Supplier Co",
  "password": "password123",
  "role": "wholesaler",
  "otp": "YOUR_OTP"
}
```

Repeat for retailer and customer with different emails and appropriate roles.

### Step 2: Login and Get Tokens

```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "wholesaler@test.com",
  "password": "password123"
}
```

Save the JWT token from response.

### Step 3: Test Wholesaler Flow

#### Add Product
```http
POST http://localhost:3000/products/add
Authorization: Bearer YOUR_WHOLESALER_TOKEN
Content-Type: application/json

{
  "name": "Premium Rice Bags (25kg)",
  "price": 50.00,
  "description": "Bulk rice for retailers",
  "category": "Groceries",
  "initial_stock": 1000,
  "minimum_order_quantity": 50
}
```

#### View Inventory
```http
GET http://localhost:3000/wholesalers/inventory
Authorization: Bearer YOUR_WHOLESALER_TOKEN
```

### Step 4: Test Retailer Flow

#### View Wholesaler Products
```http
GET http://localhost:3000/products/all
Authorization: Bearer YOUR_RETAILER_TOKEN
```

#### Place Bulk Order
```http
POST http://localhost:3000/retailers/order/wholesale
Authorization: Bearer YOUR_RETAILER_TOKEN
Content-Type: application/json

{
  "products": [
    {
      "product_id": 1,
      "quantity": 100,
      "seller_id": 2
    }
  ]
}
```

#### Add Own Product
```http
POST http://localhost:3000/products/add
Authorization: Bearer YOUR_RETAILER_TOKEN
Content-Type: application/json

{
  "name": "Rice Retail Pack (5kg)",
  "price": 15.00,
  "description": "Retail rice package",
  "category": "Groceries",
  "initial_stock": 50,
  "reorder_level": 10
}
```

#### Check Low Stock
```http
GET http://localhost:3000/retailers/inventory/low-stock
Authorization: Bearer YOUR_RETAILER_TOKEN
```

### Step 5: Test Customer Flow

#### Browse Products
```http
GET http://localhost:3000/customers/availableproducts
Authorization: Bearer YOUR_CUSTOMER_TOKEN
```

#### Place Order
```http
POST http://localhost:3000/customers/placeorder
Authorization: Bearer YOUR_CUSTOMER_TOKEN
Content-Type: application/json

{
  "productId": 2,
  "quantity": 5,
  "offlineOrder": false,
  "deliveryDetails": "123 Main St, City"
}
```

#### View Orders
```http
GET http://localhost:3000/customers/orders/YOUR_CUSTOMER_ID
Authorization: Bearer YOUR_CUSTOMER_TOKEN
```

## 🧪 Test Scenarios

### Scenario 1: Bulk Order Validation
Try ordering below minimum quantity (should fail):

```http
POST http://localhost:3000/retailers/order/wholesale
Authorization: Bearer YOUR_RETAILER_TOKEN
Content-Type: application/json

{
  "products": [
    {
      "product_id": 1,
      "quantity": 5,
      "seller_id": 2
    }
  ]
}
```

Expected: Error message about minimum order quantity

### Scenario 2: Low Stock Alert
1. Set reorder level to 20
2. Reduce stock to 15
3. Check low stock endpoint

```http
PATCH http://localhost:3000/retailers/inventory/update/2
Authorization: Bearer YOUR_RETAILER_TOKEN
Content-Type: application/json

{
  "quantity_in_stock": 15,
  "reorder_level": 20
}
```

```http
GET http://localhost:3000/retailers/inventory/low-stock
Authorization: Bearer YOUR_RETAILER_TOKEN
```

Expected: Product appears in low stock list

### Scenario 3: Stock Updates on Order
1. Check retailer stock before order
2. Customer places order
3. Check retailer stock after order

Stock should decrease by order quantity.

## 📊 Monitoring

### Check Wholesaler Analytics
```http
GET http://localhost:3000/wholesalers/analytics/sales
Authorization: Bearer YOUR_WHOLESALER_TOKEN
```

Returns:
- Total orders
- Total revenue
- Average order value
- Total units sold
- Unique buyers
- Top products

## 🔍 Troubleshooting

### Issue: "Product not found"
- Ensure product exists in database
- Check seller_id matches the product owner

### Issue: "Minimum order quantity not met"
- Check wholesaler's minimum_order_quantity setting
- Ensure order quantity >= minimum

### Issue: "Insufficient stock"
- Check inventory table for current stock
- Verify stock updates after previous orders

### Issue: "Unauthorized"
- Verify JWT token is valid
- Check user role matches endpoint requirements
- Ensure user owns the resource being modified

## 📁 File Locations

- **REST Test Files**: `src/REST-apis/*.REST`
- **Route Handlers**: `src/routes/*.js`
- **Database Init**: `src/scripts/initDB.js`
- **Constants**: `src/config/constants.js`
- **Documentation**: `*.md` files in root

## ⚙️ Configuration

Edit `src/config/constants.js` to change:
- `ABSOLUTE_WHOLESALE_MINIMUM` - Platform minimum (default: 10)
- `DEFAULT_WHOLESALE_MINIMUM` - Suggested default (default: 25)
- `DEFAULT_REORDER_LEVEL` - Low stock threshold (default: 10)

## 🎯 Next Steps

1. Test all endpoints with REST files
2. Verify inventory updates correctly
3. Check analytics data
4. Test error scenarios
5. Review migration guide if migrating existing data

## 📞 Support

- Check `IMPLEMENTATION_SUMMARY.md` for complete feature list
- Review `MIGRATION_GUIDE.md` for migration instructions
- See `INVENTORY_IMPLEMENTATION.md` for detailed documentation

## ✅ Success Checklist

- [ ] Database tables created
- [ ] Server starts without errors
- [ ] Can add products as wholesaler
- [ ] Can add products as retailer
- [ ] Retailers can order from wholesalers
- [ ] Minimum quantity validation works
- [ ] Customers can order from retailers
- [ ] Stock updates correctly
- [ ] Low stock alerts work
- [ ] Analytics show correct data

Happy testing! 🎉
