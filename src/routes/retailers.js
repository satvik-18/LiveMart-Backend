import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
const router = express.Router();
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/authmiddleware.js';
import { ABSOLUTE_WHOLESALE_MINIMUM } from '../config/constants.js';

// Get retailer's inventory
router.get('/inventory', authMiddleware, async (req, res) => {
    try {
        const { id: retailerId, role } = req.user;

        if (role !== 'retailer') {
            return res.status(403).json({ message: 'Access denied. Retailers only.' });
        }

        const result = await pool.query(`
            SELECT 
                ri.*,
                p.name,
                p.description,
                p.price,
                p.category,
                CASE 
                    WHEN ri.quantity_in_stock <= ri.reorder_level THEN true
                    ELSE false
                END as needs_restock
            FROM retailer_inventory ri
            JOIN products p ON ri.product_id = p.id
            WHERE ri.retailer_id = $1
            ORDER BY ri.updated_at DESC
        `, [retailerId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching inventory:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update inventory stock and settings
router.patch('/inventory/update/:productId', authMiddleware, async (req, res) => {
    try {
        const { id: retailerId, role } = req.user;
        const { productId } = req.params;
        const { quantity_in_stock, reorder_level } = req.body;

        if (role !== 'retailer') {
            return res.status(403).json({ message: 'Access denied. Retailers only.' });
        }

        if (quantity_in_stock !== undefined && quantity_in_stock < 0) {
            return res.status(400).json({ message: 'Stock quantity cannot be negative' });
        }

        if (reorder_level !== undefined && reorder_level < 0) {
            return res.status(400).json({ message: 'Reorder level cannot be negative' });
        }

        const result = await pool.query(`
            UPDATE retailer_inventory
            SET quantity_in_stock = COALESCE($1, quantity_in_stock),
                reorder_level = COALESCE($2, reorder_level),
                updated_at = CURRENT_TIMESTAMP
            WHERE retailer_id = $3 AND product_id = $4
            RETURNING *
        `, [quantity_in_stock, reorder_level, retailerId, productId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }

        res.json({ message: 'Inventory updated successfully', inventory: result.rows[0] });
    } catch (err) {
        console.error('Error updating inventory:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Restock inventory (add stock)
router.post('/inventory/restock/:productId', authMiddleware, async (req, res) => {
    try {
        const { id: retailerId, role } = req.user;
        const { productId } = req.params;
        const { quantity } = req.body;

        if (role !== 'retailer') {
            return res.status(403).json({ message: 'Access denied. Retailers only.' });
        }

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ message: 'Valid quantity required' });
        }

        const result = await pool.query(`
            UPDATE retailer_inventory
            SET quantity_in_stock = quantity_in_stock + $1,
                last_restocked = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE retailer_id = $2 AND product_id = $3
            RETURNING *
        `, [quantity, retailerId, productId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }

        res.json({ 
            message: `Inventory restocked with ${quantity} units successfully`, 
            inventory: result.rows[0] 
        });
    } catch (err) {
        console.error('Error restocking inventory:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get low stock alerts
router.get('/inventory/low-stock', authMiddleware, async (req, res) => {
    try {
        const { id: retailerId, role } = req.user;

        if (role !== 'retailer') {
            return res.status(403).json({ message: 'Access denied. Retailers only.' });
        }

        const result = await pool.query(`
            SELECT 
                ri.*,
                p.name,
                p.price,
                p.category,
                p.description
            FROM retailer_inventory ri
            JOIN products p ON ri.product_id = p.id
            WHERE ri.retailer_id = $1 
                AND ri.quantity_in_stock <= ri.reorder_level
            ORDER BY ri.quantity_in_stock ASC
        `, [retailerId]);

        res.json({
            message: `Found ${result.rows.length} products with low stock`,
            low_stock_items: result.rows
        });
    } catch (err) {
        console.error('Error fetching low stock items:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Place order from wholesaler (retailers buying from wholesalers)
router.post('/order/wholesale', authMiddleware, async (req, res) => {
    try {
        const { role, id: retailerId } = req.user;
        const { products } = req.body; // Array of {product_id, quantity, seller_id}

        if (role !== 'retailer') {
            return res.status(403).json({ message: 'Only retailers can buy from wholesalers' });
        }

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: 'Products array is required' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let totalAmount = 0;
            const orderItems = [];

            for (const item of products) {
                const { product_id, quantity, seller_id } = item;

                if (!product_id || !quantity || !seller_id) {
                    throw new Error('Each product must have product_id, quantity, and seller_id');
                }

                // Check seller is wholesaler
                const sellerCheck = await client.query(
                    'SELECT role FROM users WHERE id = $1',
                    [seller_id]
                );

                if (sellerCheck.rows.length === 0 || sellerCheck.rows[0].role !== 'wholesaler') {
                    throw new Error(`Seller ${seller_id} is not a wholesaler`);
                }

                // Check minimum order quantity and stock
                const inventoryCheck = await client.query(`
                    SELECT 
                        wi.minimum_order_quantity, 
                        wi.quantity_in_stock, 
                        p.name, 
                        p.price,
                        p.seller_id
                    FROM wholesaler_inventory wi
                    JOIN products p ON wi.product_id = p.id
                    WHERE wi.product_id = $1 AND wi.wholesaler_id = $2
                `, [product_id, seller_id]);

                if (inventoryCheck.rows.length === 0) {
                    throw new Error(`Product ${product_id} not found in wholesaler's inventory`);
                }

                const { minimum_order_quantity, quantity_in_stock, name, price, seller_id: productSellerId } = inventoryCheck.rows[0];

                // Verify product belongs to the wholesaler
                if (productSellerId !== seller_id) {
                    throw new Error(`Product ${name} does not belong to this wholesaler`);
                }

                // Validate bulk order requirement
                if (quantity < minimum_order_quantity) {
                    throw new Error(
                        `${name} requires minimum order of ${minimum_order_quantity} units. You requested ${quantity}.`
                    );
                }

                if (quantity_in_stock < quantity) {
                    throw new Error(`Insufficient stock for ${name}. Available: ${quantity_in_stock}`);
                }

                // Deduct from wholesaler inventory
                await client.query(`
                    UPDATE wholesaler_inventory
                    SET quantity_in_stock = quantity_in_stock - $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE product_id = $2 AND wholesaler_id = $3
                `, [quantity, product_id, seller_id]);

                // Add to retailer inventory (or update if exists)
                await client.query(`
                    INSERT INTO retailer_inventory (retailer_id, product_id, quantity_in_stock)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (retailer_id, product_id)
                    DO UPDATE SET 
                        quantity_in_stock = retailer_inventory.quantity_in_stock + $3,
                        last_restocked = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                `, [retailerId, product_id, quantity]);

                const itemTotal = parseFloat(price) * quantity;
                totalAmount += itemTotal;

                // Create order record for each product
                const orderResult = await client.query(`
                    INSERT INTO orders (
                        buyer_id, seller_id, product_id, quantity, price, total_amount, 
                        order_type, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'wholesale', 'pending')
                    RETURNING *
                `, [retailerId, seller_id, product_id, quantity, price, itemTotal]);

                orderItems.push({
                    ...orderResult.rows[0],
                    product_name: name
                });
            }

            await client.query('COMMIT');
            res.json({ 
                message: 'Wholesale order placed successfully', 
                total_amount: totalAmount.toFixed(2),
                orders: orderItems
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error placing wholesale order:', err);
        res.status(400).json({ message: err.message || 'Server error' });
    }
});

// Get retailer's purchase orders (from wholesalers)
router.get('/orders/purchases', authMiddleware, async (req, res) => {
    try {
        const { id: retailerId, role } = req.user;

        if (role !== 'retailer') {
            return res.status(403).json({ message: 'Access denied. Retailers only.' });
        }

        const result = await pool.query(`
            SELECT 
                o.*,
                p.name as product_name,
                p.description as product_description,
                u.name as wholesaler_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN users u ON o.seller_id = u.id
            WHERE o.buyer_id = $1 AND o.order_type = 'wholesale'
            ORDER BY o.order_date DESC
        `, [retailerId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching purchase orders:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get retailer's sales (to customers)
router.get('/orders/sales', authMiddleware, async (req, res) => {
    try {
        const { id: retailerId, role } = req.user;

        if (role !== 'retailer') {
            return res.status(403).json({ message: 'Access denied. Retailers only.' });
        }

        const result = await pool.query(`
            SELECT 
                o.*,
                p.name as product_name,
                p.description as product_description,
                u.name as customer_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN users u ON o.buyer_id = u.id
            WHERE o.seller_id = $1 AND o.order_type = 'retail'
            ORDER BY o.order_date DESC
        `, [retailerId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching sales orders:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
