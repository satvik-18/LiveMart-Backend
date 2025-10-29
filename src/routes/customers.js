import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
const router = express.Router();
import pool from '../config/database.js';
import {authMiddleware} from '../middleware/authmiddleware.js';

// Get available products for customers (only retail products from retailers)
router.get('/availableproducts', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'customer') {
            return res.status(403).json({
                message: 'This endpoint is for customers only'
            });
        }
        
        const result = await pool.query(`
            SELECT 
                p.*,
                ri.quantity_in_stock as stock,
                u.name as seller_name,
                u.email as seller_email
            FROM products p
            JOIN users u ON p.seller_id = u.id
            JOIN retailer_inventory ri ON p.id = ri.product_id AND p.seller_id = ri.retailer_id
            WHERE u.role = 'retailer' AND ri.quantity_in_stock > 0
            ORDER BY p.created_at DESC
        `);
        
        if (result.rows.length === 0) {
            return res.status(404).json({message: 'No products available'});
        }
        
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({message: 'Internal server error'});
    }
});

// Place order (customers buying from retailers)
router.post('/placeorder', authMiddleware, async (req, res) => {
    const { productId, quantity, offlineOrder, deliveryDetails, expectedDeliveryDate } = req.body;
    
    if (!productId || !quantity) {
        return res.status(400).json({ message: 'Product ID and quantity are required' });
    }

    if (quantity <= 0) {
        return res.status(400).json({ message: 'Quantity must be greater than 0' });
    }

    // Validate expected delivery date if provided
    if (expectedDeliveryDate && !Date.parse(expectedDeliveryDate)) {
        return res.status(400).json({ message: 'Invalid expected delivery date format' });
    }

    const client = await pool.connect();
    try {
        // Check user role
        if (req.user.role !== 'customer') {
            return res.status(403).json({ 
                message: 'Only customers can place retail orders' 
            });
        }

        await client.query('BEGIN');
        
        // Get product details with seller info and stock from retailer_inventory
        const productResult = await client.query(`
            SELECT 
                p.id, p.price, p.name, p.seller_id,
                ri.quantity_in_stock,
                u.name as seller_name, u.role as seller_role
            FROM products p
            JOIN retailer_inventory ri ON p.id = ri.product_id AND p.seller_id = ri.retailer_id
            JOIN users u ON p.seller_id = u.id
            WHERE p.id = $1
        `, [productId]);
        
        if (productResult.rows.length === 0) {
            throw new Error('Product not found or not available from any retailer');
        }
        
        const { price, seller_id, seller_role, quantity_in_stock, name } = productResult.rows[0];
        
        // Validate seller is a retailer
        if (seller_role !== 'retailer') {
            throw new Error('Customers can only order from retailers');
        }
        
        // Check stock availability
        if (quantity_in_stock < quantity) {
            throw new Error(`Insufficient stock. Available: ${quantity_in_stock}, Requested: ${quantity}`);
        }
        
        // Prevent ordering from yourself
        if (req.user.id === seller_id) {
            throw new Error('You cannot order from yourself');
        }
        
        // Update retailer inventory
        await client.query(`
            UPDATE retailer_inventory
            SET quantity_in_stock = quantity_in_stock - $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE product_id = $2 AND retailer_id = $3
        `, [quantity, productId, seller_id]);

        // Calculate total price and insert order
        const totalPrice = parseFloat(price) * quantity;
        const orderResult = await client.query(
            `INSERT INTO orders (
                buyer_id, seller_id, product_id, quantity, price, total_amount,
                order_type, status, offline_order, delivery_details, expected_delivery_date
            ) VALUES ($1, $2, $3, $4, $5, $6, 'retail', 'pending', $7, $8, $9) RETURNING *`, 
            [
                req.user.id, seller_id, productId, quantity, price, totalPrice,
                offlineOrder || false, deliveryDetails || null, 
                expectedDeliveryDate ? new Date(expectedDeliveryDate) : null
            ]
        );
        
        await client.query('COMMIT');
        
        return res.status(201).json({
            message: 'Order placed successfully',
            order: {
                ...orderResult.rows[0],
                product_name: name
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error placing order:', error);
        return res.status(400).json({ message: error.message || 'Internal server error' });
    } finally {
        client.release();
    }
});

// Get customer's orders
router.get('/orders/:customerId', authMiddleware, async (req, res) => {
    const { customerId } = req.params;

    try {
        // Verify the customer is requesting their own orders
        if (req.user.id !== parseInt(customerId) && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // Enhanced query to get more order details including product and seller information
        const result = await pool.query(`
            SELECT 
                o.*,
                p.name as product_name,
                p.description as product_description,
                u.name as seller_name,
                u.email as seller_email
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN users u ON o.seller_id = u.id
            WHERE o.buyer_id = $1 AND o.order_type = 'retail'
            ORDER BY o.order_date DESC
        `, [customerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No orders found for this customer' });
        }

        // Format the response
        const formattedOrders = result.rows.map(order => ({
            orderId: order.id,
            productInfo: {
                id: order.product_id,
                name: order.product_name,
                description: order.product_description
            },
            orderDetails: {
                quantity: order.quantity,
                price: order.price,
                totalAmount: order.total_amount,
                status: order.status,
                orderDate: order.order_date,
                isOfflineOrder: order.offline_order,
                deliveryDetails: order.delivery_details,
                expectedDeliveryDate: order.expected_delivery_date
            },
            sellerInfo: {
                id: order.seller_id,
                name: order.seller_name,
                email: order.seller_email
            }
        }));

        return res.status(200).json(formattedOrders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;