//index.js
import express from 'express';
import pool from './src/config/database.js';
import redis from './src/config/redis.js';
import { initDB } from './src/scripts/initDB.js';
import authRoutes from './src/routes/auth.js';

const app = express();
app.use(express.json());

// Mount authentication routes
app.use('/auth', authRoutes);

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