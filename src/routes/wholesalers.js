import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
const router = express.Router();
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/authmiddleware.js';
import { ABSOLUTE_WHOLESALE_MINIMUM, DEFAULT_WHOLESALE_MINIMUM } from '../config/constants.js';

// Get wholesaler's inventory
router.get('/inventory', authMiddleware, async (req, res) => {
    try {
        const { id: wholesalerId, role } = req.user;

        if (role !== 'wholesaler') {
            return res.status(403).json({ message: 'Access denied. Wholesalers only.' });
        }

        const result = await pool.query(`
            SELECT 
                wi.*,
                p.name,
                p.description,
                p.price,
                p.category
            FROM wholesaler_inventory wi
            JOIN products p ON wi.product_id = p.id
            WHERE wi.wholesaler_id = $1
            ORDER BY wi.updated_at DESC
        `, [wholesalerId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching inventory:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update inventory stock and settings
router.patch('/inventory/update/:productId', authMiddleware, async (req, res) => {
    try {
        const { id: wholesalerId, role } = req.user;
        const { productId } = req.params;
        const { quantity_in_stock, minimum_order_quantity } = req.body;

        if (role !== 'wholesaler') {
            return res.status(403).json({ message: 'Access denied. Wholesalers only.' });
        }

        if (quantity_in_stock !== undefined && quantity_in_stock < 0) {
            return res.status(400).json({ message: 'Stock quantity cannot be negative' });
        }

        if (minimum_order_quantity !== undefined && minimum_order_quantity < ABSOLUTE_WHOLESALE_MINIMUM) {
            return res.status(400).json({ 
                message: `Minimum order quantity cannot be less than ${ABSOLUTE_WHOLESALE_MINIMUM} units` 
            });
        }

        const result = await pool.query(`
            UPDATE wholesaler_inventory
            SET quantity_in_stock = COALESCE($1, quantity_in_stock),
                minimum_order_quantity = COALESCE($2, minimum_order_quantity),
                updated_at = CURRENT_TIMESTAMP
            WHERE wholesaler_id = $3 AND product_id = $4
            RETURNING *
        `, [quantity_in_stock, minimum_order_quantity, wholesalerId, productId]);

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
        const { id: wholesalerId, role } = req.user;
        const { productId } = req.params;
        const { quantity } = req.body;

        if (role !== 'wholesaler') {
            return res.status(403).json({ message: 'Access denied. Wholesalers only.' });
        }

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ message: 'Valid quantity required' });
        }

        const result = await pool.query(`
            UPDATE wholesaler_inventory
            SET quantity_in_stock = quantity_in_stock + $1,
                last_restocked = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE wholesaler_id = $2 AND product_id = $3
            RETURNING *
        `, [quantity, wholesalerId, productId]);

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

// Get wholesaler's sales (to retailers)
router.get('/orders/sales', authMiddleware, async (req, res) => {
    try {
        const { id: wholesalerId, role } = req.user;

        if (role !== 'wholesaler') {
            return res.status(403).json({ message: 'Access denied. Wholesalers only.' });
        }

        const result = await pool.query(`
            SELECT 
                o.*,
                p.name as product_name,
                p.description as product_description,
                u.name as retailer_name,
                u.email as retailer_email
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN users u ON o.buyer_id = u.id
            WHERE o.seller_id = $1 AND o.order_type = 'wholesale'
            ORDER BY o.order_date DESC
        `, [wholesalerId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching sales orders:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get sales analytics
router.get('/analytics/sales', authMiddleware, async (req, res) => {
    try {
        const { id: wholesalerId, role } = req.user;

        if (role !== 'wholesaler') {
            return res.status(403).json({ message: 'Access denied. Wholesalers only.' });
        }

        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                AVG(total_amount) as average_order_value,
                SUM(quantity) as total_units_sold,
                COUNT(DISTINCT buyer_id) as unique_buyers
            FROM orders
            WHERE seller_id = $1 AND order_type = 'wholesale'
        `, [wholesalerId]);

        const topProducts = await pool.query(`
            SELECT 
                p.name,
                p.id as product_id,
                COUNT(o.id) as order_count,
                SUM(o.quantity) as total_quantity_sold,
                SUM(o.total_amount) as total_revenue
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.seller_id = $1 AND o.order_type = 'wholesale'
            GROUP BY p.id, p.name
            ORDER BY total_revenue DESC
            LIMIT 10
        `, [wholesalerId]);

        res.json({
            summary: result.rows[0],
            top_products: topProducts.rows
        });
    } catch (err) {
        console.error('Error fetching analytics:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update order status
router.patch('/orders/:orderId/status', authMiddleware, async (req, res) => {
    try {
        const { id: wholesalerId, role } = req.user;
        const { orderId } = req.params;
        const { status } = req.body;

        if (role !== 'wholesaler') {
            return res.status(403).json({ message: 'Access denied. Wholesalers only.' });
        }

        const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
            });
        }

        // Verify ownership
        const orderCheck = await pool.query(
            'SELECT * FROM orders WHERE id = $1 AND seller_id = $2',
            [orderId, wholesalerId]
        );

        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found or unauthorized' });
        }

        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 AND seller_id = $3 RETURNING *',
            [status, orderId, wholesalerId]
        );

        res.json({ 
            message: 'Order status updated successfully', 
            order: result.rows[0] 
        });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
