import pool from '../config/database.js';

/**
 * Migration script to update existing database to new inventory system
 * Run this ONCE to migrate from old schema to new schema
 */

async function migrate() {
    const client = await pool.connect();
    
    try {
        console.log('Starting migration...');
        
        await client.query('BEGIN');
        
        // Step 1: Add seller_id column to products if it doesn't exist
        console.log('Step 1: Adding seller_id to products table...');
        await client.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        `);
        
        // Step 2: Migrate seller names to seller_id (if you have existing data)
        console.log('Step 2: Migrating seller names to seller_id...');
        await client.query(`
            UPDATE products p
            SET seller_id = u.id
            FROM users u
            WHERE p.seller = u.name AND p.seller_id IS NULL;
        `);
        
        // Step 3: Add new columns to products
        console.log('Step 3: Adding category and updated_at columns...');
        await client.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS category VARCHAR(100);
            
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        
        // Step 4: Create inventory tables
        console.log('Step 4: Creating retailer_inventory table...');
        await client.query(`
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
        `);
        
        console.log('Step 5: Creating wholesaler_inventory table...');
        await client.query(`
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
        `);
        
        // Step 6: Migrate existing product stock to inventory tables
        console.log('Step 6: Migrating existing stock to inventory tables...');
        
        // For retail products
        await client.query(`
            INSERT INTO retailer_inventory (retailer_id, product_id, quantity_in_stock, reorder_level)
            SELECT 
                p.seller_id,
                p.id,
                COALESCE(p.stock, 0),
                10
            FROM products p
            JOIN users u ON p.seller_id = u.id
            WHERE u.role = 'retailer' 
                AND p.seller_id IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM retailer_inventory ri 
                    WHERE ri.retailer_id = p.seller_id AND ri.product_id = p.id
                )
            ON CONFLICT (retailer_id, product_id) DO NOTHING;
        `);
        
        // For wholesale products
        await client.query(`
            INSERT INTO wholesaler_inventory (wholesaler_id, product_id, quantity_in_stock, minimum_order_quantity)
            SELECT 
                p.seller_id,
                p.id,
                COALESCE(p.stock, 0),
                25
            FROM products p
            JOIN users u ON p.seller_id = u.id
            WHERE u.role = 'wholesaler' 
                AND p.seller_id IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM wholesaler_inventory wi 
                    WHERE wi.wholesaler_id = p.seller_id AND wi.product_id = p.id
                )
            ON CONFLICT (wholesaler_id, product_id) DO NOTHING;
        `);
        
        // Step 7: Update orders table
        console.log('Step 7: Updating orders table...');
        await client.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS buyer_id INTEGER REFERENCES users(id);
            
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2);
            
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'retail';
        `);
        
        // Migrate customer_id to buyer_id
        await client.query(`
            UPDATE orders 
            SET buyer_id = customer_id 
            WHERE buyer_id IS NULL AND customer_id IS NOT NULL;
        `);
        
        // Make customer_id nullable so new orders can use buyer_id
        console.log('Step 7.1: Making customer_id nullable...');
        await client.query(`
            ALTER TABLE orders 
            ALTER COLUMN customer_id DROP NOT NULL;
        `);
        
        // Set order_type based on buyer role
        await client.query(`
            UPDATE orders o
            SET order_type = CASE 
                WHEN EXISTS (
                    SELECT 1 FROM users 
                    WHERE id = o.buyer_id AND role = 'customer'
                ) THEN 'retail'
                WHEN EXISTS (
                    SELECT 1 FROM users 
                    WHERE id = o.buyer_id AND role = 'retailer'
                ) THEN 'wholesale'
                ELSE 'retail'
            END
            WHERE order_type IS NULL OR order_type = 'retail';
        `);
        
        // Calculate total_amount from price * quantity
        await client.query(`
            UPDATE orders
            SET total_amount = price * quantity
            WHERE total_amount IS NULL;
        `);
        
        // Step 8: Create indexes
        console.log('Step 8: Creating indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
            CREATE INDEX IF NOT EXISTS idx_retailer_inventory_retailer ON retailer_inventory(retailer_id);
            CREATE INDEX IF NOT EXISTS idx_retailer_inventory_product ON retailer_inventory(product_id);
            CREATE INDEX IF NOT EXISTS idx_wholesaler_inventory_wholesaler ON wholesaler_inventory(wholesaler_id);
            CREATE INDEX IF NOT EXISTS idx_wholesaler_inventory_product ON wholesaler_inventory(product_id);
            CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
            CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
            CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
        `);
        
        await client.query('COMMIT');
        console.log('✅ Migration completed successfully!');
        console.log('\nOptional cleanup (run manually if needed):');
        console.log('  ALTER TABLE products DROP COLUMN IF EXISTS stock;');
        console.log('  ALTER TABLE products DROP COLUMN IF EXISTS product_type;');
        console.log('  ALTER TABLE products DROP COLUMN IF EXISTS seller;');
        console.log('  ALTER TABLE orders DROP COLUMN IF EXISTS customer_id;');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
migrate()
    .then(() => {
        console.log('\n🎉 Database migration complete!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n💥 Migration error:', err);
        process.exit(1);
    });
