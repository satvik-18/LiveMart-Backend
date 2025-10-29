//index.js
import express from 'express';
import pool from './src/config/database.js';
import redis from './src/config/redis.js';
import { initDB } from './src/scripts/initDB.js';
import authRoutes from './src/routes/auth.js';
import productRoutes from './src/routes/products.js';
import customerRoutes from './src/routes/customers.js';
import retailerRoutes from './src/routes/retailers.js';
import wholesalerRoutes from './src/routes/wholesalers.js';
import wishlistRoutes from './src/routes/wishlists.js';
import reviewRoutes from './src/routes/reviews.js';

import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

// Mount authentication routes
app.use('/auth', authRoutes);

// Mount product routes (general product browsing)
app.use('/products', productRoutes);

// Mount role-specific routes
app.use('/customers', customerRoutes);
app.use('/retailers', retailerRoutes);
app.use('/wholesalers', wholesalerRoutes);

// Mount feature routes
app.use('/wishlists', wishlistRoutes);
app.use('/reviews', reviewRoutes);

// Temporary debug endpoint - remove in production
app.get('/debug/header', (req, res) => {
	res.json({ authorization: req.headers['authorization'] || null });
});

const PORT = process.env.PORT || 3000;

(async () => {
	try {
		await initDB();
		const client = await pool.connect();
		console.log('Database connected successfully!');
		client.release();
		
		// Optionally, you can also check Redis connection here if needed
		app.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
		});
	} catch (err) {
		console.error('Startup error:', err);
		process.exit(1);
	}
})();