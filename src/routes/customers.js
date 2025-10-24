import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
const router = express.Router();
import pool from '../config/database.js';
import {authMiddleware} from '../middleware/authmiddleware.js';

router.get('/availableproducts', authMiddleware, async (req, res)=>{
    try{
        let productType;
        
        // Determine what products the user can see based on role
        if (req.user.role === 'customer') {
            productType = 'retail';
        } else if (req.user.role === 'retailer') {
            productType = 'wholesale';
        } else if (req.user.role === 'wholesaler') {
            return res.status(403).json({
                message: 'Wholesalers cannot order products. You are a supplier only.'
            });
        } else {
            return res.status(403).json({message: 'Invalid user role'});
        }
        
        const result = await pool.query(
            'SELECT * FROM products WHERE product_type = $1', 
            [productType]
        );
        
        if(result.rows.length === 0){
            return res.status(404).json({message: 'No products found'});
        }
        
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({message: 'Internal server error'});
    }
});
router.post('/placeorder', authMiddleware, async (req, res)=>{
    const { productId, quantity, offlineOrder, deliveryDetails, expectedDeliveryDate } = req.body;
    
    if (!productId || !quantity) {
        return res.status(400).json({ message: 'Product ID and quantity are required' });
    }

    // Validate expected delivery date if provided
    if (expectedDeliveryDate && !Date.parse(expectedDeliveryDate)) {
        return res.status(400).json({ message: 'Invalid expected delivery date format' });
    }

    try {
        // Check if wholesaler is trying to order
        if (req.user.role === 'wholesaler') {
            return res.status(403).json({ 
                message: 'Wholesalers cannot place orders. You are a supplier only.' 
            });
        }
        
        // Get product details AND seller info in one query
        const productResult = await pool.query(`
            SELECT p.price, p.stock, p.product_type, p.seller, u.id as seller_id, u.role as seller_role
            FROM products p
            JOIN users u ON p.seller = u.name
            WHERE p.id = $1
        `, [productId]);
        
        if (productResult.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        const { price, stock, product_type, seller, seller_id, seller_role } = productResult.rows[0];
        
        // Validate supply chain rules
        if (req.user.role === 'customer' && product_type !== 'retail') {
            return res.status(403).json({ 
                message: 'Customers can only order retail products' 
            });
        }
        
        if (req.user.role === 'retailer' && product_type !== 'wholesale') {
            return res.status(403).json({ 
                message: 'Retailers can only order wholesale products' 
            });
        }
        
        // Additional check: Ensure seller role matches product type
        if (product_type === 'wholesale' && seller_role !== 'wholesaler') {
            return res.status(400).json({ 
                message: 'Invalid product: wholesale products must be sold by wholesalers' 
            });
        }
        
        if (product_type === 'retail' && seller_role !== 'retailer') {
            return res.status(400).json({ 
                message: 'Invalid product: retail products must be sold by retailers' 
            });
        }
        
        // Check stock availability
        if (stock < quantity) {
            return res.status(400).json({ message: 'Insufficient stock' });
        }
        
        // Prevent ordering from yourself
        if (req.user.id === seller_id) {
            return res.status(400).json({ 
                message: 'You cannot order from yourself' 
            });
        }
        
        // Update stock
        const newStock = stock - quantity;
        await pool.query(
            'UPDATE products SET stock = $1 WHERE id = $2', 
            [newStock, productId]
        );

        // Calculate total price and insert order
        const totalPrice = price * quantity;
        const result = await pool.query(
            `INSERT INTO orders (
                customer_id, product_id, quantity, price, seller_id, status,
                offline_order, delivery_details, expected_delivery_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, 
            [
                req.user.id, productId, quantity, totalPrice, seller_id, 'pending',
                offlineOrder || false, deliveryDetails || null, 
                expectedDeliveryDate ? new Date(expectedDeliveryDate) : null
            ]
        );
        
        return res.status(201).json({
            message: 'Order placed successfully',
            order: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error placing order:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/orders/:customerId', authMiddleware, async (req, res)=>{
    const { customerId } = req.params;

    try {
        // Enhanced query to get more order details including product and seller information
        const result = await pool.query(`
            SELECT 
                o.*,
                p.name as product_name,
                p.description as product_description,
                u.name as seller_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN users u ON o.seller_id = u.id
            WHERE o.customer_id = $1
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
                status: order.status,
                orderDate: order.order_date,
                isOfflineOrder: order.offline_order,
                deliveryDetails: order.delivery_details,
                expectedDeliveryDate: order.expected_delivery_date
            },
            sellerInfo: {
                id: order.seller_id,
                name: order.seller_name
            }
        }));

        return res.status(200).json(formattedOrders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

//To Order a product

export default router;