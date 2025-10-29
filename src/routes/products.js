import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
const router = express.Router();
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/authmiddleware.js';
import { ABSOLUTE_WHOLESALE_MINIMUM, DEFAULT_WHOLESALE_MINIMUM, DEFAULT_REORDER_LEVEL } from '../config/constants.js';

// Get all products with inventory information (role-based filtering)
router.get('/all', authMiddleware, async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        
        let query = `
            SELECT 
                p.*,
                u.name as seller_name,
                u.role as seller_role,
                CASE 
                    WHEN u.role = 'retailer' THEN ri.quantity_in_stock
                    WHEN u.role = 'wholesaler' THEN wi.quantity_in_stock
                    ELSE NULL
                END as stock_quantity,
                CASE 
                    WHEN u.role = 'wholesaler' THEN wi.minimum_order_quantity
                    ELSE NULL
                END as minimum_order_quantity
            FROM products p
            JOIN users u ON p.seller_id = u.id
            LEFT JOIN retailer_inventory ri ON p.id = ri.product_id AND p.seller_id = ri.retailer_id
            LEFT JOIN wholesaler_inventory wi ON p.id = wi.product_id AND p.seller_id = wi.wholesaler_id
        `;

        // Filter based on user role (business logic)
        if (role === 'customer') {
            // Customers see only products from retailers
            query += ` WHERE u.role = 'retailer'`;
        } else if (role === 'retailer') {
            // Retailers see only products from wholesalers
            query += ` WHERE u.role = 'wholesaler'`;
        }
        // Wholesalers see all products (for reference)

        query += ` ORDER BY p.created_at DESC`;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get products by seller
router.get('/seller/:sellerId', authMiddleware, async (req, res) => {
    try {
        const { sellerId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                p.*,
                u.name as seller_name,
                u.role as seller_role,
                CASE 
                    WHEN u.role = 'retailer' THEN ri.quantity_in_stock
                    WHEN u.role = 'wholesaler' THEN wi.quantity_in_stock
                END as stock_quantity,
                CASE 
                    WHEN u.role = 'wholesaler' THEN wi.minimum_order_quantity
                    ELSE NULL
                END as minimum_order_quantity
            FROM products p
            JOIN users u ON p.seller_id = u.id
            LEFT JOIN retailer_inventory ri ON p.id = ri.product_id AND p.seller_id = ri.retailer_id
            LEFT JOIN wholesaler_inventory wi ON p.id = wi.product_id AND p.seller_id = wi.wholesaler_id
            WHERE p.seller_id = $1
            ORDER BY p.created_at DESC
        `, [sellerId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching seller products:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add new product (retailers and wholesalers only)
router.post('/add', authMiddleware, async (req, res) => {
    try {
        const { role, id: sellerId } = req.user;
        
        if (role === 'customer') {
            return res.status(403).json({ message: 'Customers cannot add products' });
        }

        const { name, description, price, category, initial_stock, minimum_order_quantity, reorder_level } = req.body;

        if (!name || !price || initial_stock === undefined) {
            return res.status(400).json({ message: 'Name, price, and initial stock are required' });
        }

        if (initial_stock < 0) {
            return res.status(400).json({ message: 'Initial stock cannot be negative' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert product
            const productResult = await client.query(
                `INSERT INTO products (seller_id, name, description, price, category)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [sellerId, name, description, price, category]
            );

            const product = productResult.rows[0];

            // Insert into appropriate inventory table
            if (role === 'retailer') {
                const reorderLvl = reorder_level || DEFAULT_REORDER_LEVEL;
                await client.query(
                    `INSERT INTO retailer_inventory (retailer_id, product_id, quantity_in_stock, reorder_level)
                     VALUES ($1, $2, $3, $4)`,
                    [sellerId, product.id, initial_stock, reorderLvl]
                );
            } else if (role === 'wholesaler') {
                const minOrderQty = minimum_order_quantity || DEFAULT_WHOLESALE_MINIMUM;
                
                // Validate minimum order quantity
                if (minOrderQty < ABSOLUTE_WHOLESALE_MINIMUM) {
                    throw new Error(`Minimum order quantity cannot be less than ${ABSOLUTE_WHOLESALE_MINIMUM} units`);
                }
                
                await client.query(
                    `INSERT INTO wholesaler_inventory (wholesaler_id, product_id, quantity_in_stock, minimum_order_quantity)
                     VALUES ($1, $2, $3, $4)`,
                    [sellerId, product.id, initial_stock, minOrderQty]
                );
            }

            await client.query('COMMIT');
            res.status(201).json({ 
                message: 'Product added successfully', 
                product: {
                    ...product,
                    stock_quantity: initial_stock,
                    minimum_order_quantity: role === 'wholesaler' ? (minimum_order_quantity || DEFAULT_WHOLESALE_MINIMUM) : null,
                    reorder_level: role === 'retailer' ? (reorder_level || DEFAULT_REORDER_LEVEL) : null
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error adding product:', err);
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// Update product
router.patch('/update/:productId', authMiddleware, async (req, res) => {
    try {
        const { id: sellerId, role } = req.user;
        const { productId } = req.params;
        const { name, description, price, category } = req.body;

        if (role === 'customer') {
            return res.status(403).json({ message: 'Customers cannot update products' });
        }

        // Verify ownership
        const ownerCheck = await pool.query(
            'SELECT * FROM products WHERE id = $1 AND seller_id = $2',
            [productId, sellerId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found or unauthorized' });
        }

        const result = await pool.query(
            `UPDATE products 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 price = COALESCE($3, price),
                 category = COALESCE($4, category),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 AND seller_id = $6
             RETURNING *`,
            [name, description, price, category, productId, sellerId]
        );

        res.json({ message: 'Product updated successfully', product: result.rows[0] });
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete product
router.delete('/delete/:productId', authMiddleware, async (req, res) => {
    try {
        const { id: sellerId, role } = req.user;
        const { productId } = req.params;

        if (role === 'customer') {
            return res.status(403).json({ message: 'Customers cannot delete products' });
        }

        const result = await pool.query(
            'DELETE FROM products WHERE id = $1 AND seller_id = $2 RETURNING *',
            [productId, sellerId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found or unauthorized' });
        }

        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get my products (for sellers)
router.get('/myproducts', authMiddleware, async (req, res) => {
    try {
        const { role, id: sellerId } = req.user;
        
        if (role === 'customer') {
            return res.status(403).json({ 
                message: 'Customers cannot access this page. Only retailers and wholesalers can view their products.' 
            });
        }

        const result = await pool.query(`
            SELECT 
                p.*,
                CASE 
                    WHEN $2 = 'retailer' THEN ri.quantity_in_stock
                    WHEN $2 = 'wholesaler' THEN wi.quantity_in_stock
                END as stock_quantity,
                CASE 
                    WHEN $2 = 'retailer' THEN ri.reorder_level
                    ELSE NULL
                END as reorder_level,
                CASE 
                    WHEN $2 = 'wholesaler' THEN wi.minimum_order_quantity
                    ELSE NULL
                END as minimum_order_quantity,
                CASE 
                    WHEN $2 = 'retailer' AND ri.quantity_in_stock <= ri.reorder_level THEN true
                    ELSE false
                END as needs_restock
            FROM products p
            LEFT JOIN retailer_inventory ri ON p.id = ri.product_id AND p.seller_id = ri.retailer_id
            LEFT JOIN wholesaler_inventory wi ON p.id = wi.product_id AND p.seller_id = wi.wholesaler_id
            WHERE p.seller_id = $1
            ORDER BY p.created_at DESC
        `, [sellerId, role]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;