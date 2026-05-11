// =============================================
//   EVENTS ROUTES — Full CRUD API
// =============================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function formatEvent(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        date: row.date,
        category: row.category,
        priority: row.priority,
        isCompleted: row.is_completed === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ---- GET /api/events ----
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const { search, filter, category, sort } = req.query;

        let sql = 'SELECT * FROM events WHERE user_id = ?';
        const params = [req.user.id];

        if (filter === 'pending') { sql += ' AND is_completed = 0'; }
        if (filter === 'completed') { sql += ' AND is_completed = 1'; }
        if (filter === 'important') { sql += " AND priority = 'important'"; }
        if (filter === 'urgent') { sql += " AND priority = 'urgent'"; }
        if (filter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            sql += ' AND date = ?'; params.push(today);
        }
        if (filter === 'overdue') {
            const today = new Date().toISOString().split('T')[0];
            sql += ' AND date < ? AND is_completed = 0'; params.push(today);
        }
        if (category && category !== 'all') { sql += ' AND category = ?'; params.push(category); }
        if (search && search.trim()) {
            const q = '%' + search.trim() + '%';
            sql += ' AND (title LIKE ? OR description LIKE ?)';
            params.push(q, q);
        }

        const sortMap = {
            date: 'date ASC',
            priority: "CASE priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END ASC",
            title: 'title ASC',
            status: 'is_completed ASC',
        };
        sql += ` ORDER BY ${sortMap[sort] || 'date ASC'}`;

        const rows = db.prepare(sql).all(...params);
        return res.json({ success: true, events: rows.map(formatEvent) });

    } catch (err) {
        console.error('GET /events error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch events.' });
    }
});

// ---- GET /api/events/stats ----
router.get('/stats', (req, res) => {
    try {
        const db = getDb();
        const uid = req.user.id;
        const total = (db.prepare('SELECT COUNT(*) AS c FROM events WHERE user_id = ?').get(uid) || {}).c || 0;
        const done = (db.prepare('SELECT COUNT(*) AS c FROM events WHERE user_id = ? AND is_completed = 1').get(uid) || {}).c || 0;
        const imp = (db.prepare("SELECT COUNT(*) AS c FROM events WHERE user_id = ? AND priority IN ('important','urgent') AND is_completed = 0").get(uid) || {}).c || 0;
        return res.json({ success: true, stats: { total, pending: total - done, done, important: imp } });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
    }
});

// ---- POST /api/events ----
router.post('/', (req, res) => {
    try {
        const db = getDb();
        const { title, description, date, category, priority } = req.body;

        if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required.' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required.' });

        const id = uuidv4();
        const now = new Date().toISOString().replace('T', ' ').split('.')[0];
        const validCats = ['general', 'work', 'personal', 'health', 'social', 'education'];
        const validPrios = ['normal', 'important', 'urgent'];

        db.prepare('INSERT INTO events (id, user_id, title, description, date, category, priority, is_completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
            .run(id, req.user.id, title.trim(), (description || '').trim(), date,
                validCats.includes(category) ? category : 'general',
                validPrios.includes(priority) ? priority : 'normal',
                now, now);

        const created = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
        return res.status(201).json({ success: true, message: 'Event created!', event: formatEvent(created) });

    } catch (err) {
        console.error('POST /events error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create event.' });
    }
});

// ---- PUT /api/events/:id ----
router.put('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const existing = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Event not found.' });

        const {
            title = existing.title,
            description = existing.description,
            date = existing.date,
            category = existing.category,
            priority = existing.priority,
            isCompleted,
        } = req.body;

        const is_completed = isCompleted !== undefined ? (isCompleted ? 1 : 0) : existing.is_completed;
        const now = new Date().toISOString().replace('T', ' ').split('.')[0];

        db.prepare('UPDATE events SET title=?, description=?, date=?, category=?, priority=?, is_completed=?, updated_at=? WHERE id=? AND user_id=?')
            .run(title.trim(), (description || '').trim(), date, category, priority, is_completed, now, id, req.user.id);

        const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
        return res.json({ success: true, message: 'Event updated!', event: formatEvent(updated) });

    } catch (err) {
        console.error('PUT /events/:id error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update event.' });
    }
});

// ---- DELETE /api/events/:id ----
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const existing = db.prepare('SELECT id FROM events WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Event not found.' });
        db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').run(id, req.user.id);
        return res.json({ success: true, message: 'Event deleted.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete event.' });
    }
});

module.exports = router;
