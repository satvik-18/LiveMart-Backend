# Step-by-Step Testing Guide Using REST Files

## Prerequisites
✅ Server is running on http://localhost:3000
✅ Database migration completed
✅ VS Code REST Client extension installed

---

## Testing Workflow

### Phase 1: Create Test Users (Authentication)

Open `src/REST-apis/auth.REST` file in VS Code.

#### Step 1: Create Wholesaler Account

1. **Request OTP** - Click "Send Request" above this line:
```http
POST http://localhost:3000/auth/signup/request-otp
Content-Type: application/json

{
  "email": "wholesaler@test.com"
}
```

2. **Check your email** for OTP code

3. **Verify OTP and Create Account** - Replace OTP and click "Send Request":
```http
POST http://localhost:3000/auth/signup/verify
Content-Type: application/json

{
  "name": "Big Wholesale Co",
  "email": "wholesaler@test.com",
  "password": "test123",
  "role": "wholesaler",
  "otp": "YOUR_OTP_HERE"
}
```

4. **Login to get JWT token**:
```http
POST http://localhost:3000/auth/login/email
Content-Type: application/json

{
  "email": "wholesaler@test.com",
  "password": "test123"
}
```

5. **SAVE THE TOKEN** from response! You'll need it.

#### Step 2: Create Retailer Account

Repeat the same process but use:
- Email: `retailer@test.com`
- Name: `Retail Store Inc`
- Role: `"retailer"`

#### Step 3: Create Customer Account

Repeat the same process but use:
- Email: `customer@test.com`
- Name: `John Customer`
- Role: `"customer"`

---

### Phase 2: Test Wholesaler Flow

Open `src/REST-apis/wholesalers.REST` file.

#### Update the token at the top:
```http
@baseUrl = http://localhost:3000
@token = YOUR_WHOLESALER_TOKEN_HERE
```

#### Test 1: Add Product
```http
POST {{baseUrl}}/products/add
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Bulk Rice Bags (25kg)",
  "price": 50.00,
  "description": "Premium quality rice for retailers",
  "category": "Groceries",
  "initial_stock": 1000,
  "minimum_order_quantity": 50
}
```

✅ Expected: 201 Created, product added with inventory

#### Test 2: View Inventory
```http
GET {{baseUrl}}/wholesalers/inventory
Authorization: Bearer {{token}}
```

✅ Expected: 200 OK, list showing your product with stock=1000, min_qty=50

#### Test 3: View My Products
```http
GET {{baseUrl}}/products/myproducts
Authorization: Bearer {{token}}
```

✅ Expected: 200 OK, list of your products

---

### Phase 3: Test Retailer Flow

Open `src/REST-apis/retailers.REST` file.

#### Update the token:
```http
@baseUrl = http://localhost:3000
@token = YOUR_RETAILER_TOKEN_HERE
```

#### Test 1: View Wholesaler Products
```http
GET {{baseUrl}}/products/all
Authorization: Bearer {{token}}
```

✅ Expected: 200 OK, shows only wholesaler products (the rice you added)

#### Test 2: Order from Wholesaler (Bulk Order)

**First, get the product_id and seller_id from previous response**

```http
POST {{baseUrl}}/retailers/order/wholesale
Authorization: Bearer {{token}}
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

✅ Expected: 201 Created, order placed
✅ Verify: Wholesaler stock decreased to 900
✅ Verify: Retailer inventory now has 100 units

#### Test 3: View Retailer Inventory
```http
GET {{baseUrl}}/retailers/inventory
Authorization: Bearer {{token}}
```

✅ Expected: Shows the rice with quantity_in_stock=100

#### Test 4: Add Retail Product
```http
POST {{baseUrl}}/products/add
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Rice Retail Pack (5kg)",
  "price": 15.00,
  "description": "Quality rice for customers",
  "category": "Groceries",
  "initial_stock": 50,
  "reorder_level": 10
}
```

✅ Expected: 201 Created, retail product added

#### Test 5: Check Low Stock
```http
GET {{baseUrl}}/retailers/inventory/low-stock
Authorization: Bearer {{token}}
```

✅ Expected: Empty list (stock is above reorder level)

---

### Phase 4: Test Customer Flow

Open `src/REST-apis/customert.REST` file (or create a new one).

#### Update the token:
```http
@baseUrl = http://localhost:3000
@token = YOUR_CUSTOMER_TOKEN_HERE
```

#### Test 1: Browse Available Products
```http
GET {{baseUrl}}/customers/availableproducts
Authorization: Bearer {{token}}
```

✅ Expected: Shows only retailer products (not wholesaler products)

#### Test 2: Place Order

**Get product_id from previous response**

```http
POST {{baseUrl}}/customers/placeorder
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "productId": 2,
  "quantity": 5,
  "offlineOrder": false,
  "deliveryDetails": "123 Main Street, Test City"
}
```

✅ Expected: 201 Created, order placed
✅ Verify: Retailer stock decreased by 5

#### Test 3: View Order History
```http
GET {{baseUrl}}/customers/orders/YOUR_CUSTOMER_ID
Authorization: Bearer {{token}}
```

✅ Expected: Shows your order with product and seller details

---

### Phase 5: Test Business Logic Validation

#### Test 1: Bulk Order Minimum Validation

Try ordering BELOW minimum quantity:

```http
POST {{baseUrl}}/retailers/order/wholesale
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

❌ Expected: 400 Error, "requires minimum order of 50 units"

#### Test 2: Insufficient Stock

Try ordering MORE than available:

```http
POST {{baseUrl}}/customers/placeorder
Authorization: Bearer YOUR_CUSTOMER_TOKEN
Content-Type: application/json

{
  "productId": 2,
  "quantity": 10000
}
```

❌ Expected: 400 Error, "Insufficient stock"

#### Test 3: Wrong User Role

Try customer adding product:

```http
POST {{baseUrl}}/products/add
Authorization: Bearer YOUR_CUSTOMER_TOKEN
Content-Type: application/json

{
  "name": "Test Product",
  "price": 100
}
```

❌ Expected: 403 Forbidden, "Customers cannot add products"

---

### Phase 6: Advanced Features

#### Test Retailer Low Stock Alerts

1. Set stock below reorder level:
```http
PATCH {{baseUrl}}/retailers/inventory/update/2
Authorization: Bearer YOUR_RETAILER_TOKEN
Content-Type: application/json

{
  "quantity_in_stock": 5,
  "reorder_level": 10
}
```

2. Check low stock alerts:
```http
GET {{baseUrl}}/retailers/inventory/low-stock
Authorization: Bearer YOUR_RETAILER_TOKEN
```

✅ Expected: Product appears in low stock list

#### Test Wholesaler Analytics
```http
GET {{baseUrl}}/wholesalers/analytics/sales
Authorization: Bearer YOUR_WHOLESALER_TOKEN
```

✅ Expected: Summary with total orders, revenue, top products

---

## How to Use REST Files in VS Code

1. **Open any .REST file** (e.g., `auth.REST`)
2. **Look for the `###` separator** - each section is a separate request
3. **Click "Send Request"** link that appears above each HTTP method
4. **View response** in the right panel
5. **Copy values** from responses (like tokens, IDs) to use in next requests

---

## Tips

### Saving Tokens
At the top of each REST file, define variables:
```http
@baseUrl = http://localhost:3000
@wholesalerToken = eyJhbGc...
@retailerToken = eyJhbGc...
@customerToken = eyJhbGc...
```

Then use them:
```http
Authorization: Bearer {{wholesalerToken}}
```

### Quick Testing Checklist

- [ ] 3 users created (wholesaler, retailer, customer)
- [ ] Tokens saved for each user
- [ ] Wholesaler added product with min_qty
- [ ] Retailer ordered from wholesaler (valid quantity)
- [ ] Retailer added retail product
- [ ] Customer ordered from retailer
- [ ] Tested minimum quantity validation (should fail)
- [ ] Tested insufficient stock (should fail)
- [ ] Tested wrong role access (should fail)
- [ ] Checked low stock alerts
- [ ] Viewed analytics

---

## Common Issues

### Issue: 401 Unauthorized
- Check token is valid and not expired
- Re-login to get fresh token

### Issue: 404 Not Found
- Check product_id, seller_id exist
- Verify you're using correct IDs from database

### Issue: Column does not exist
- Run migration again: `node src/scripts/migrate.js`

---

## Success Indicators

✅ Wholesaler can add products and set minimum quantities
✅ Retailer can only see wholesaler products
✅ Retailer can order in bulk (>= minimum)
✅ Retailer orders update both inventories
✅ Customer can only see retailer products
✅ Customer orders update retailer stock
✅ Low stock alerts work
✅ Analytics show correct data
✅ Business rules are enforced

---

## Need Help?

- Check server logs in terminal
- Review `QUICK_START.md`
- See `TESTING_CHECKLIST.md` for detailed scenarios
- Verify database with: `SELECT * FROM retailer_inventory;`

Happy Testing! 🚀
