
import pool from '../config/database.js';

// Example table creation queries
const createTablesQuery = `
CREATE TABLE IF NOT EXISTS users (
	id SERIAL PRIMARY KEY,
	name VARCHAR(100) NOT NULL,
	email VARCHAR(100) UNIQUE NOT NULL,
	password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'customer',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
	id SERIAL PRIMARY KEY,
	name VARCHAR(100) NOT NULL,
	price NUMERIC(10,2) NOT NULL,
	stock INT DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
