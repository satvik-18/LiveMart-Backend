import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

function authMiddleware(req, res, next) {
	const authHeader = req.headers['authorization'];
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res.status(401).json({ message: 'No token provided' });
	}
	const token = authHeader.split(' ')[1];
	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		req.user = decoded;
		next();
	} catch (err) {
		return res.status(401).json({ message: 'Invalid or expired token' });
	}
}

const router = express.Router();

// Public login route (no middleware)
router.post('/login', (req, res) => {
	const { username } = req.body;
	if (!username) {
		return res.status(400).json({ message: 'Username required' });
	}
	const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
	res.json({ token });
});

// Protected route
router.get('/protected', authMiddleware, (req, res) => {
	res.json({ message: 'Access granted', user: req.user });
});

export default router;