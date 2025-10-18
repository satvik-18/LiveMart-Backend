import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import redis from '../config/redis.js';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

async function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        // Check if token is blacklisted
        const isBlacklisted = await redis.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return res.status(401).json({ message: 'Token has been revoked' });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        
        // Check if user still exists in database
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [decoded.id]);
        if (userCheck.rows.length === 0) {
            return res.status(401).json({ message: 'User no longer exists' });
        }

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
}

export { authMiddleware };
export default authMiddleware;