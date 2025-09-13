# LiveMart-Backend
Backend for OOP-Project-2025

## Signup with Email & OTP Verification

### 1. Request OTP

**Endpoint:** `POST /auth/signup/request-otp`

**Body:**
```json
{
	"email": "user@example.com"
}
```

**Response:**
- 200: `{ "message": "OTP sent to email." }`
- 409: `{ "message": "Email already registered." }`
- 429: `{ "message": "Too many OTP requests. Try again in X seconds." }`

### 2. Complete Signup (Verify OTP)

**Endpoint:** `POST /auth/signup/verify`

**Body:**
```json
{
	"name": "User Name",
	"email": "user@example.com",
	"password": "yourpassword",
	"role": "customer",
	"otp": "123456"
}
```

**Response:**
- 201: `{ "token": "...", "user": { "id": 1, "name": "User Name", "email": "user@example.com", "role": "customer" } }`
- 400: `{ "message": "Invalid or expired OTP." }`
- 409: `{ "message": "Email already registered." }`

### 3. Login (Demo Only)

**Endpoint:** `POST /auth/login`

**Body:**
```json
{
	"username": "testuser"
}
```

**Response:**
- 200: `{ "token": "..." }`

### 4. Protected Route Example

**Endpoint:** `GET /auth/protected`

**Headers:**
`Authorization: Bearer <token>`

**Response:**
- 200: `{ "message": "Access granted", "user": { ... } }`
