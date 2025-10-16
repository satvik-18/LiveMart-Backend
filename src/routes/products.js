import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
const router = express.Router();
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/authmiddleware.js';   

router.get('/home', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        res.json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});
router.post('/products', authMiddleware, async (req, res) => {
    try {
        const { name, price, stock, description } = req.body;
        // Use the authenticated user's name or email as the seller
        const seller = req.user.name || req.user.email || req.user.username;
        
        const result = await pool.query(
            'INSERT INTO products (name, price, stock, description, seller) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, price, stock, description, seller]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});
router.delete('/delete', authMiddleware, async (req, res) => {
    try {
        const { id } = req.body;
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully', product: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});
export default router;