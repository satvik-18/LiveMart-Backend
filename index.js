
import pool from './src/config/database.js';
import redis from './src/config/redis.js';
import { initDB } from './src/scripts/initDB.js';

// Initialize DB tables, then test DB connection
(async () => {
	try {
		await initDB();
		const client = await pool.connect();
		console.log('Database connected successfully!');
		client.release();
		// Optionally, you can also check Redis connection here if needed
		process.exit(0);
	} catch (err) {
		console.error('Startup error:', err);
		process.exit(1);
	}
})();
