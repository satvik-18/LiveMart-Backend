
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import OTPService from '../services/otpservice.js';
import sendOTPEmail from '../services/emailService.js';
import verifyGoogleToken from '../services/oauth.js';

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

// Email/password login route
router.post('/login/email', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        // Find user by email
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Store refresh token in Redis
        await redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
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
	const { name, email, password, role, otp } = req.body;
	if (!name || !email || !password || !role || !otp) {
		return res.status(400).json({ message: 'Name, email, password, role, and OTP are required.' });
	}
	try {

		const userCheck = await pool.query('SELECT id FROM users WHERE email = $1 OR name = $2', [email, name]);
		if (userCheck.rows.length > 0) {
			const existingUser = userCheck.rows[0];
			const emailExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
			const nameExists = await pool.query('SELECT id FROM users WHERE name = $1', [name]);
			
			if (emailExists.rows.length > 0 && nameExists.rows.length > 0) {
				return res.status(409).json({ message: 'Email and name already registered.' });
			} else if (emailExists.rows.length > 0) {
				return res.status(409).json({ message: 'Email already registered.' });
			} else {
				return res.status(409).json({ message: 'Name already taken.' });
			}
		}

		const valid = await OTPService.verifyOTP(email, otp);
		if (!valid) {
			return res.status(400).json({ message: 'Invalid or expired OTP.' });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const result = await pool.query(
			'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
			[name, email, hashedPassword, role]
		);
		const user = result.rows[0];

		const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
		res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
	} catch (err) {
		console.error('Signup error:', err);
		res.status(500).json({ message: 'Internal server error.' });
	}
});
router.post('/forgot-password/request-otp', async (req, res) => {
	const { email } = req.body;
	if (!email) {
		return res.status(400).json({ message: 'Email is required' });
	}
	try {
		const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
		if (userCheck.rows.length === 0) {
			return res.status(404).json({ message: 'User not found' });
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
router.post('/forgot-password/verify', async (req, res) => {
	const { email, newPassword, otp } = req.body;
	if (!email || !newPassword || !otp) {
		return res.status(400).json({ message: 'Email, new password, and OTP are required.' });
	}
	try {
		const valid = await OTPService.verifyOTP(email, otp);
		if (!valid) {
			return res.status(400).json({ message: 'Invalid or expired OTP.' });
		}

		const hashedPassword = await bcrypt.hash(newPassword, 10);
		await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);
		res.json({ message: 'Password updated successfully.' });
	} catch (err) {
		console.error('Password reset error:', err);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

router.post('/google-login', async (req, res) => {
	const { token } = req.body;
	if (!token) {
		return res.status(400).json({ message: 'Google token is required.' });
	}
	try {
		const payload = await verifyGoogleToken(token);
		const { sub: google_id, email, name, picture } = payload;

		// Check if user already exists with this google_id or email
		const existingUser = await pool.query(
			'SELECT id, name, email, role FROM users WHERE google_id = $1 OR email = $2',
			[google_id, email]
		);

		let user;
		if (existingUser.rows.length > 0) {
			// User exists, log them in
			user = existingUser.rows[0];
			
			// Update google_id if user signed up with email but now using Google
			if (!user.google_id) {
				await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [google_id, user.id]);
			}
		} else {
			// New user, create account
			const result = await pool.query(
				'INSERT INTO users (name, email, google_id, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
				[name, email, google_id, 'customer']
			);
			user = result.rows[0];
		}

		const jwtToken = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
		res.json({ token: jwtToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
	} catch (err) {
		console.error('Google login error:', err);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Protected route
// Token refresh endpoint
router.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
    }

    try {
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, JWT_SECRET);
        
        // Check if token is in Redis
        const storedToken = await redis.get(`refresh_token:${decoded.id}`);
        if (!storedToken || storedToken !== refreshToken) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        // Get user data
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.rows[0];

        // Generate new access token
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ accessToken });
    } catch (err) {
        console.error('Token refresh error:', err);
        res.status(401).json({ message: 'Invalid refresh token' });
    }
});

// Logout endpoint
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        // Remove refresh token from Redis
        await redis.del(`refresh_token:${req.user.id}`);
        
        // Add access token to blacklist
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.decode(token);
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        
        if (expiresIn > 0) {
            await redis.setex(`blacklist:${token}`, expiresIn, 'true');
        }

        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Change password endpoint
router.post('/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
    }

    try {
        // Get user from database
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.rows[0];

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Hash new password and update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/protected', authMiddleware, (req, res) => {
	res.json({ message: 'Access granted', user: req.user });
});

export default router;