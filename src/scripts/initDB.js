
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
	name VARCHAR(100) NOT NULL,
	price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
	stock INT DEFAULT 0 CHECK (stock >= 0),
	product_type VARCHAR(50) DEFAULT 'retail', CHECK (product_type IN ('retail', 'wholesale')),
	description TEXT,
	seller VARCHAR(100),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders(
	id SERIAL PRIMARY KEY,
	price NUMERIC(10,2) NOT NULL CHECK( price >= 0),
	quantity INT DEFAULT 1 CHECK (quantity > 0),
	customer_id INT NOT NULL REFERENCES users(id),
	product_id INT NOT NULL REFERENCES products(id),
	status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled')),
	order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlists(
	id SERIAL PRIMARY KEY,
	customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(customer_id, product_id)
);
`;

export async function initDB() {
	try {
		await pool.query(createTablesQuery);
		console.log('Tables created or already exist.');
	} catch (err) {
		console.error('Error creating tables:', err);
		throw err;
	}
}
