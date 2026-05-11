// =============================================
//   EVENT REMINDER SYSTEM — EXPRESS SERVER
// =============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// ---- Middleware ----
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Request Logger ----
app.use((req, res, next) => {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ${req.method} ${req.path}`);
    next();
});

// ---- Health Check ----
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        uptime: Math.round(process.uptime()) + 's',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// ---- Serve Frontend Static Files ----
// Local dev: server.js is in /backend, frontend is at /frontend (one level up)
// Azure deploy: server.js is at root, frontend is at /frontend (same level)
const FRONTEND_DIR = fs.existsSync(path.join(__dirname, 'frontend'))
    ? path.join(__dirname, 'frontend')
    : path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// ---- Global Error Handler ----
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ---- Boot: Init DB first, then mount routes & start ----
async function boot() {
    try {
        await initDb();

        // Mount routes AFTER db is ready
        const authRoutes = require('./routes/auth');
        const eventsRoutes = require('./routes/events');
        app.use('/api/auth', authRoutes);
        app.use('/api/events', eventsRoutes);

        // SPA Fallback
        app.get('*', (req, res) => {
            if (req.path.startsWith('/api/')) {
                return res.status(404).json({ success: false, message: 'Endpoint not found.' });
            }
            res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
        });

        app.listen(PORT, () => {
            console.log('');
            console.log('╔══════════════════════════════════════════╗');
            console.log('║    🗓️  EventReminder Backend Server       ║');
            console.log('╠══════════════════════════════════════════╣');
            console.log(`║  🚀 http://localhost:${PORT}                   ║`);
            console.log(`║  🗄️  SQLite database: events.db           ║`);
            console.log(`║  🔐 JWT Auth enabled                      ║`);
            console.log('╚══════════════════════════════════════════╝');
            console.log('');
            console.log(`  Open: http://localhost:${PORT}/login.html`);
            console.log('');
        });

    } catch (err) {
        console.error('❌ Boot failed:', err);
        process.exit(1);
    }
}

boot();
