
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import OTPService from '../services/otpservice.js';
import sendOTPEmail from '../services/emailService.js';

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


// 1. Request OTP for signup
router.post('/signup/request-otp', async (req, res) => {
	const { email } = req.body;
	if (!email) {
		return res.status(400).json({ message: 'Email is required' });
	}
	try {
		// Check if user already exists
		const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
		if (userCheck.rows.length > 0) {
			return res.status(409).json({ message: 'Email already registered.' });
		}

		const rate = await OTPService.checkRateLimit(email);
		if (!rate.allowed) {
			return res.status(429).json({ message: `Too many OTP requests. Try again in ${rate.resetTime} seconds.` });
		}

		const otp = OTPService.generateOTP();
		await OTPService.storeOTP(email, otp);
		await sendOTPEmail(email, otp);
		res.json({ message: 'OTP sent to email.' });
	} catch (err) {
		console.error('OTP request error:', err);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

router.post('/signup/verify', async (req, res) => {
	const { name, email, password, otp } = req.body;
	if (!name || !email || !password || !otp) {
		return res.status(400).json({ message: 'Name, email, password, and OTP are required.' });
	}
	try {

		const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
		if (userCheck.rows.length > 0) {
			return res.status(409).json({ message: 'Email already registered.' });
		}

		const valid = await OTPService.verifyOTP(email, otp);
		if (!valid) {
			return res.status(400).json({ message: 'Invalid or expired OTP.' });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const result = await pool.query(
			'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
			[name, email, hashedPassword]
		);
		const user = result.rows[0];

		const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '1h' });
		res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
	} catch (err) {
		console.error('Signup error:', err);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Protected route
router.get('/protected', authMiddleware, (req, res) => {
	res.json({ message: 'Access granted', user: req.user });
});

export default router;