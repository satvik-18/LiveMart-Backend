import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
const router = express.Router();
import pool from '../config/database.js';
import {authMiddleware} from '../middleware/authmiddleware.js';

router.get('/availableproducts', authMiddleware, async (req, res)=>{
    try{
        const result = await pool.query('SELECT * FROM products WHERE product_type = $1', ['retail'] );
        if(result.rows.length === 0){
            return res.status(404).json({message: 'No products found'});
        }
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({message: 'Internal server error'});
    }
})

//To Order a product

export default router;