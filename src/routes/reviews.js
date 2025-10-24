import express from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/authmiddleware.js';

const router = express.Router();

// Add a review (only customers who purchased the product)
router.post('/add', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'customer') {
            return res.status(403).json({ message: 'Only customers can add reviews' });
        }

        const { productId, rating, title, body } = req.body;
        if (!productId || !rating) {
            return res.status(400).json({ message: 'productId and rating are required' });
        }

        const r = parseInt(rating, 10);
        if (isNaN(r) || r < 1 || r > 5) {
            return res.status(400).json({ message: 'rating must be an integer between 1 and 5' });
        }

        // Ensure the user has purchased this product
        const purchaseCheck = await pool.query(
            'SELECT 1 FROM orders WHERE customer_id = $1 AND product_id = $2',
            [req.user.id, productId]
        );
        if (purchaseCheck.rows.length === 0) {
            return res.status(403).json({ message: 'You can only review products you have purchased' });
        }

        // Insert review, UNIQUE(customer_id, product_id) ensures single review per user per product
        const insert = await pool.query(
            `INSERT INTO reviews (customer_id, product_id, rating, title, body)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (customer_id, product_id) DO UPDATE
                SET rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [req.user.id, productId, r, title || null, body || null]
        );

        res.status(201).json({ message: 'Review saved', review: insert.rows[0] });
    } catch (err) {
        console.error('Error adding review:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get reviews for a product
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const result = await pool.query(
            `SELECT r.id, r.rating, r.title, r.body, r.created_at, r.updated_at, u.id as user_id, u.name as user_name
             FROM reviews r
             JOIN users u ON r.customer_id = u.id
             WHERE r.product_id = $1
             ORDER BY r.created_at DESC`,
            [productId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching reviews:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get current user's reviews
router.get('/myreviews', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.*, p.name as product_name, p.price
             FROM reviews r
             JOIN products p ON r.product_id = p.id
             WHERE r.customer_id = $1
             ORDER BY r.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching my reviews:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update a review (owner only)
router.patch('/update', authMiddleware, async (req, res) => {
    try {
        const { id, rating, title, body } = req.body;
        if (!id) return res.status(400).json({ message: 'Review id is required' });

        // Verify ownership
        const check = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Review not found' });
        if (check.rows[0].customer_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        const r = rating ? parseInt(rating, 10) : check.rows[0].rating;
        if (rating && (isNaN(r) || r < 1 || r > 5)) return res.status(400).json({ message: 'rating must be an integer between 1 and 5' });

        const result = await pool.query(
            `UPDATE reviews SET rating = $1, title = $2, body = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
            [r, title || check.rows[0].title, body || check.rows[0].body, id]
        );
        res.json({ message: 'Review updated', review: result.rows[0] });
    } catch (err) {
        console.error('Error updating review:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete a review (owner only)
router.delete('/delete', authMiddleware, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ message: 'Review id is required' });

        const check = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Review not found' });
        if (check.rows[0].customer_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
        res.json({ message: 'Review deleted' });
    } catch (err) {
        console.error('Error deleting review:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
