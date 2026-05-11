// =============================================
//   AUTH ROUTES — Register & Login
// =============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();

function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

// ---- POST /api/auth/register ----
router.post('/register', async (req, res) => {
    try {
        const db = getDb();
        const { name, email, password } = req.body;

        if (!name || name.trim().length < 2)
            return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
        if (!email || !/\S+@\S+\.\S+/.test(email))
            return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        if (!password || password.length < 6)
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
        if (existing)
            return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

        const passwordHash = await bcrypt.hash(password, 12);
        const userId = uuidv4();
        const now = new Date().toISOString().replace('T', ' ').split('.')[0];

        db.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(userId, name.trim(), email.toLowerCase(), passwordHash, now);

        const user = { id: userId, name: name.trim(), email: email.toLowerCase() };
        const token = signToken(user);
        return res.status(201).json({ success: true, message: 'Account created!', token, user });

    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// ---- POST /api/auth/login ----
router.post('/login', async (req, res) => {
    try {
        const db = getDb();
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email and password are required.' });

        const user = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get(email.toLowerCase());
        if (!user)
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match)
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        const token = signToken(user);
        return res.status(200).json({
            success: true,
            message: 'Login successful!',
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// ---- GET /api/auth/me ----
router.get('/me', require('../middleware/auth'), (req, res) => {
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user });
});

module.exports = router;
