import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.EXTERNAL_DATABASE_URL || process.env.INTERNAL_DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
    
})
export default pool;
