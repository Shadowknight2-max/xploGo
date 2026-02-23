const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the root xploGo folder
app.use(express.static(path.join(__dirname, '..')));

// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database: ' + process.env.DB_NAME);
});

// --- Auth Endpoints --- //

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const query = 'SELECT id, name, email FROM users WHERE email = ? AND password = ?';

    db.query(query, [email, password], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Server error' });

        if (results.length > 0) {
            res.json({ success: true, user: results[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});

// Google Auth 
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ success: false, message: 'No Google Token provided' });
    }

    try {
        let name, email;

        // If GOOGLE_CLIENT_ID is not set in .env, we will fall back to decoding client-side for demonstration. 
        // DO NOT DO THIS IN PRODUCTION.
        if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
            console.warn("⚠️ WARNING: GOOGLE_CLIENT_ID not set in .env. Falling back to unsafe payload decode.");
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            name = payload.name;
            email = payload.email;
        } else {
            // Very secure verification via Google's servers
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();

            // ✅ CRITICAL SECURITY CHECK: Account must be verified
            if (!payload.email_verified) {
                return res.status(403).json({ success: false, message: 'Google account is not verified' });
            }

            name = payload.name;
            email = payload.email;
        }

        // Check if user exists
        db.query('SELECT id, name, email FROM users WHERE email = ?', [email], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: 'Server error' });

            if (results.length > 0) {
                // User exists, log them in
                res.json({ success: true, user: results[0] });
            } else {
                // New user, create account with dummy password
                const dummyPassword = 'google_oauth_' + Math.random().toString(36).substr(2, 9);
                const insertQuery = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';

                db.query(insertQuery, [name, email, dummyPassword], (err, insertResults) => {
                    if (err) return res.status(500).json({ success: false, message: 'Failed to create account via Google' });

                    res.json({ success: true, user: { id: insertResults.insertId, name, email } });
                });
            }
        });
    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(401).json({ success: false, message: 'Invalid Google Token' });
    }
});

// Signup
app.post('/api/auth/signup', (req, res) => {
    const { name, email, password } = req.body;

    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Server error' });

        if (results.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // Insert new user
        const insertQuery = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
        db.query(insertQuery, [name, email, password], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: 'Signup failed' });

            res.json({
                success: true,
                user: { id: results.insertId, name, email }
            });
        });
    });
});

// --- Trip Endpoints --- //

// Get Plan
app.get('/api/trips/:userId', (req, res) => {
    const userId = req.params.userId;
    const query = 'SELECT id, user_id, place_name AS name, place_type AS type, cost, image, description, day, date_added FROM trips WHERE user_id = ? ORDER BY date_added DESC';

    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(results);
    });
});

// Add to Plan
app.post('/api/trips/add', (req, res) => {
    const { user_id, name, type, cost, image, description } = req.body;
    const query = 'INSERT INTO trips (user_id, place_name, place_type, cost, image, description) VALUES (?, ?, ?, ?, ?, ?)';

    db.query(query, [user_id, name, type, cost, image, description], (err, results) => {
        if (err) {
            console.error("Add trip error:", err);
            return res.status(500).json({ success: false, message: 'Failed to add item', error: err.message });
        }
        res.json({ success: true, id: results.insertId });
    });
});

// Save Export Record
app.post('/api/trips/export', (req, res) => {
    const { user_id, total_budget, items_count, pdf_base64 } = req.body;
    const query = 'INSERT INTO trip_exports (user_id, total_budget, items_count, pdf_base64) VALUES (?, ?, ?, ?)';

    db.query(query, [user_id, total_budget, items_count, pdf_base64], (err, results) => {
        if (err) {
            console.error("Export save error:", err);
            return res.status(500).json({ success: false, message: 'Failed to save export record' });
        }
        res.json({ success: true, id: results.insertId });
    });
});

// Update Trip Day
app.put('/api/trips/:id/day', (req, res) => {
    const { id } = req.params;
    const { day } = req.body;
    const query = 'UPDATE trips SET day = ? WHERE id = ?';

    db.query(query, [day, id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to update day' });
        res.json({ success: true });
    });
});

// Remove Trip Item
app.delete('/api/trips/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM trips WHERE id = ?';

    db.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to delete item' });
        res.json({ success: true });
    });
});

// --- Admin Endpoints --- //

app.get('/api/admin/users', (req, res) => {
    const query = 'SELECT id, name, email, joined FROM users ORDER BY joined DESC';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(results);
    });
});

app.get('/api/admin/trips', (req, res) => {
    const query = `
        SELECT trips.id, trips.user_id, trips.place_name AS name, trips.place_type AS type, trips.cost, trips.image, trips.description, trips.day, trips.date_added, users.name as userName 
        FROM trips 
        JOIN users ON trips.user_id = users.id 
        ORDER BY trips.date_added DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(results);
    });
});

app.get('/api/admin/exports', (req, res) => {
    const query = `
        SELECT trip_exports.*, users.name as userName 
        FROM trip_exports 
        JOIN users ON trip_exports.user_id = users.id 
        ORDER BY trip_exports.exported_at DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(results);
    });
});

app.delete('/api/admin/users/:id', (req, res) => {
    const userId = req.params.id;
    // Will cascade delete trips as defined in schema.sql
    const query = 'DELETE FROM users WHERE id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to delete user' });
        res.json({ success: true, message: 'User deleted' });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
