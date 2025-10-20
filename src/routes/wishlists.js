import express from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/authmiddleware.js';

const router = express.Router();

// Add a product to wishlist
router.post('/add', authMiddleware, async (req, res) => {
    try {
        // Only customers can add to wishlist
        if (req.user.role !== 'customer') {
            return res.status(403).json({
                message: 'Only customers can add products to wishlist'
            });
        }

        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required' });
        }

        // Check if product exists and is of type 'retail'
        const productCheck = await pool.query(
            'SELECT * FROM products WHERE id = $1 AND product_type = $2',
            [productId, 'retail']
        );

        if (productCheck.rows.length === 0) {
            return res.status(404).json({
                message: 'Product not found or not available for customers'
            });
        }

        // Add to wishlist
        await pool.query(
            'INSERT INTO wishlists (customer_id, product_id) VALUES ($1, $2) ON CONFLICT (customer_id, product_id) DO NOTHING',
            [req.user.id, productId]
        );

        res.status(201).json({ 
            message: 'Product added to wishlist successfully'
        });

    } catch (err) {
        console.error('Error adding to wishlist:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Remove a product from wishlist
router.delete('/remove', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'customer') {
            return res.status(403).json({
                message: 'Only customers can manage wishlist'
            });
        }

        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required' });
        }

        const result = await pool.query(
            'DELETE FROM wishlists WHERE customer_id = $1 AND product_id = $2 RETURNING *',
            [req.user.id, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Product not found in wishlist'
            });
        }

        res.json({ message: 'Product removed from wishlist successfully' });

    } catch (err) {
        console.error('Error removing from wishlist:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get user's wishlist with product details
router.get('/list', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'customer') {
            return res.status(403).json({
                message: 'Only customers can view wishlist'
            });
        }

        const result = await pool.query(`
            SELECT 
                p.id,
                p.name,
                p.price,
                p.stock,
                p.description,
                p.seller,
                w.added_date
            FROM wishlists w
            JOIN products p ON w.product_id = p.id
            WHERE w.customer_id = $1
            ORDER BY w.added_date DESC
        `, [req.user.id]);

        res.json(result.rows);

    } catch (err) {
        console.error('Error fetching wishlist:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Check if a product is in user's wishlist
router.get('/check/:productId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'customer') {
            return res.status(403).json({
                message: 'Only customers can access wishlist'
            });
        }

        const { productId } = req.params;
        const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM wishlists WHERE customer_id = $1 AND product_id = $2)',
            [req.user.id, productId]
        );

        res.json({ isInWishlist: result.rows[0].exists });

    } catch (err) {
        console.error('Error checking wishlist:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;