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
        // Check if user has retailer or wholesaler role
        if (req.user.role !== 'retailer' && req.user.role !== 'wholesaler') {
            return res.status(403).json({ message: 'Access denied. Only retailers and wholesalers can add products.' });
        }

        const { name, price, stock, product_type, description } = req.body;
        // Use the authenticated user's name or email as the seller
        const seller = req.user.name || req.user.email || req.user.username;
        
        const result = await pool.query(
            'INSERT INTO products (name, price, stock, product_type, description, seller) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, price, stock, product_type, description, seller]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/delete', authMiddleware, async (req, res) => {
    try {
        // Check if user has retailer or wholesaler role
        if (req.user.role !== 'retailer' && req.user.role !== 'wholesaler') {
            return res.status(403).json({ message: 'Access denied. Only retailers and wholesalers can delete products.' });
        }

        const { id } = req.body;
        const seller = req.user.name || req.user.email || req.user.username;
        
        // Check if product exists and belongs to the user
        const product = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        if (product.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        if (product.rows[0].seller !== seller) {
            return res.status(403).json({ message: 'Access denied. You can only delete your own products.' });
        }
        
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        res.json({ message: 'Product deleted successfully', product: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/update', authMiddleware, async(req, res)=>{
    try{
        // Check if user has retailer or wholesaler role
        if (req.user.role !== 'retailer' && req.user.role !== 'wholesaler') {
            return res.status(403).json({ message: 'Access denied. Only retailers and wholesalers can update products.' });
        }

        const{id, name, price, stock, product_type, description} = req.body;
        const seller = req.user.name || req.user.email || req.user.username;
        
        // Check if product exists and belongs to the user
        const product = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        if(product.rows.length === 0){
            return res.status(404).json({message: 'Product Not Found'});
        }
        if (product.rows[0].seller !== seller) {
            return res.status(403).json({ message: 'Access denied. You can only update your own products.' });
        }
        
        const result = await pool.query(
            'UPDATE products SET name = $1, price = $2, stock = $3, product_type = $4, description = $5 WHERE id = $6 RETURNING *',
            [name, price, stock, product_type, description, id]
        );
        res.json({message: 'Product updated successfully', product: result.rows[0]});
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
})

router.get('/myproducts', authMiddleware, async(req, res)=>{
    try{
        if(req.user.role !== 'retailer' && req.user.role !== 'wholesale'){
            return res.status(403).json({message: "You cannot access this page. only retailers and wholesalers can view the products they posted"});
        }

        const result = await pool.query('SELECT * FROM products WHERE seller = $1', [req.user.name || req.user.email || req.user.username]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
})
export default router;