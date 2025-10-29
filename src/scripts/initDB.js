
import pool from '../config/database.js';

// Example table creation queries
const createTablesQuery = `
CREATE TABLE IF NOT EXISTS users (
	id SERIAL PRIMARY KEY,
	name VARCHAR(100) NOT NULL,
	email VARCHAR(100) UNIQUE NOT NULL,
	password VARCHAR(255),
	google_id VARCHAR(255) UNIQUE,
    role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'retailer', 'wholesaler')),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
	id SERIAL PRIMARY KEY,
	seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	name VARCHAR(100) NOT NULL,
	price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
	description TEXT,
	category VARCHAR(100),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders(
	id SERIAL PRIMARY KEY,
	buyer_id INT NOT NULL REFERENCES users(id),
	seller_id INT NOT NULL REFERENCES users(id),
	product_id INT NOT NULL REFERENCES products(id),
	quantity INT NOT NULL CHECK (quantity > 0),
	price NUMERIC(10,2) NOT NULL CHECK( price >= 0),
	total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
	order_type VARCHAR(50) DEFAULT 'retail' CHECK (order_type IN ('retail', 'wholesale')),
	status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled')),
	order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	offline_order BOOLEAN DEFAULT FALSE,
	delivery_details TEXT,
	expected_delivery_date TIMESTAMP
);

CREATE TABLE IF NOT EXISTS retailer_inventory (
	id SERIAL PRIMARY KEY,
	retailer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	quantity_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
	reorder_level INTEGER DEFAULT 10 CHECK (reorder_level >= 0),
	last_restocked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(retailer_id, product_id)
);

CREATE TABLE IF NOT EXISTS wholesaler_inventory (
	id SERIAL PRIMARY KEY,
	wholesaler_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	quantity_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
	minimum_order_quantity INTEGER DEFAULT 25 CHECK (minimum_order_quantity >= 10),
	last_restocked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(wholesaler_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlists(
	id SERIAL PRIMARY KEY,
	customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews(
	id SERIAL PRIMARY KEY,
	customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
	title VARCHAR(255),
	body TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP,
	UNIQUE(customer_id, product_id)
);
`;

export async function initDB() {
	try {
		await pool.query(createTablesQuery);
		console.log('Tables created or already exist.');
		
		// Create indexes for better performance
		const createIndexesQuery = `
			CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
			CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
			CREATE INDEX IF NOT EXISTS idx_retailer_inventory_retailer ON retailer_inventory(retailer_id);
			CREATE INDEX IF NOT EXISTS idx_retailer_inventory_product ON retailer_inventory(product_id);
			CREATE INDEX IF NOT EXISTS idx_wholesaler_inventory_wholesaler ON wholesaler_inventory(wholesaler_id);
			CREATE INDEX IF NOT EXISTS idx_wholesaler_inventory_product ON wholesaler_inventory(product_id);
			CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
			CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
			CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
		`;
		
		await pool.query(createIndexesQuery);
		console.log('Indexes created successfully.');
		
		// Migration: Add new columns to orders table if they don't exist
		const alterOrdersTableQuery = `
			ALTER TABLE orders 
			ADD COLUMN IF NOT EXISTS offline_order BOOLEAN DEFAULT FALSE;
			
			ALTER TABLE orders 
			ADD COLUMN IF NOT EXISTS delivery_details TEXT;
			
			ALTER TABLE orders 
			ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMP;
			
			ALTER TABLE orders 
			ADD COLUMN IF NOT EXISTS buyer_id INTEGER REFERENCES users(id);
			
			ALTER TABLE orders 
			ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2);
			
			ALTER TABLE orders 
			ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'retail';
		`;
		
		await pool.query(alterOrdersTableQuery);
		console.log('Orders table columns updated successfully.');
		
	} catch (err) {
		console.error('Error creating/updating tables:', err);
		throw err;
	}
}
