const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('./db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
let Iyzipay = null;
try { Iyzipay = require('iyzipay'); } catch (_) { Iyzipay = null; }
require('dotenv').config();
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = process.env.PORT || 5500;
const IS_PROD = String(process.env.NODE_ENV).toLowerCase() === 'production';

// Security headers with CSP allowing required external assets
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:", "https:", "http:"],
        // In dev allow inline for existing handlers; in prod disallow
        "script-src": IS_PROD ? ["'self'", "https://*.iyzipay.com"] : ["'self'", "'unsafe-inline'", "https://*.iyzipay.com"],
        "script-src-attr": IS_PROD ? [] : ["'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        "font-src": ["'self'", "data:", "https://cdnjs.cloudflare.com"],
        "connect-src": ["'self'", "https://*.iyzipay.com"],
        "frame-src": ["'self'", "https://*.iyzipay.com"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'self'"],
        "base-uri": ["'self'"]
    }
}));
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(limiter);

// Swagger UI - minimal spec
const openApiSpec = {
    openapi: '3.0.0',
    info: { title: 'Keyco API', version: '1.0.0' },
    paths: {
        '/api/health': { get: { summary: 'Health', responses: { '200': { description: 'OK' } } } },
        '/api/auth/register': { post: { summary: 'Register' } },
        '/api/auth/login': { post: { summary: 'Login' } },
        '/api/products': { get: { summary: 'List products' } },
        '/api/payments/create': { post: { summary: 'Create payment intent' } },
        '/api/payments/verify': { post: { summary: 'Verify payment' } },
        '/api/payments/webhook': { post: { summary: 'Payment provider webhook' } },
    }
};
// Serve Swagger UI (ensure both /api/docs and /api/docs/ work)
app.use('/api/docs', swaggerUi.serve);
app.get('/api/docs', (req, res) => res.redirect('/api/docs/'));
app.get('/api/docs/', swaggerUi.setup(openApiSpec));

// JWT helpers
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const IYZICO_API_KEY = process.env.IYZICO_API_KEY || '';
const IYZICO_SECRET = process.env.IYZICO_SECRET || '';
const IYZICO_BASE_URL = process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com';
const HAS_IYZIPAY = Boolean(Iyzipay && IYZICO_API_KEY && IYZICO_SECRET);
const iyzico = HAS_IYZIPAY ? new Iyzipay({ apiKey: IYZICO_API_KEY, secretKey: IYZICO_SECRET, uri: IYZICO_BASE_URL }) : null;

// Fulfill digital product codes for a paid order
function fulfillDigitalCodes(orderId) {
    const items = db.prepare('SELECT id, product_id, quantity FROM order_items WHERE order_id = ?').all(orderId);
    const insertDelivered = db.prepare('INSERT INTO order_item_codes (order_item_id, product_id, code_id, code) VALUES (?, ?, ?, ?)');
    const markUsed = db.prepare('UPDATE product_codes SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?');

    for (const item of items) {
        const needed = Math.max(1, Number(item.quantity || 1));
        const available = db.prepare('SELECT id, code FROM product_codes WHERE product_id = ? AND is_used = 0 ORDER BY id ASC LIMIT ?').all(item.product_id, needed);
        if (available.length < needed) {
            // Not enough codes, mark order as processing and continue
            db.prepare('INSERT INTO order_tracking (order_id, status, message) VALUES (?, ?, ?)')
              .run(orderId, 'processing', `Ürün #${item.product_id} için kod stoğu yetersiz (${available.length}/${needed}).`);
            continue;
        }
        for (let i = 0; i < needed; i++) {
            const codeRow = available[i];
            insertDelivered.run(item.id, item.product_id, codeRow.id, codeRow.code);
            markUsed.run(codeRow.id);
        }
    }
}

function getTokenFromCookie(req) {
    try {
        const cookie = req.headers.cookie || '';
        const parts = cookie.split(/;\s*/);
        for (const p of parts) {
            if (p.startsWith('token=')) {
                return decodeURIComponent(p.substring('token='.length));
            }
        }
    } catch (_) {}
    return null;
}

function signToken(payload, expiresIn = '7d') {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function generateCode6() {
    try {
        const n = crypto.randomInt(0, 1000000);
        return String(n).padStart(6, '0');
    } catch (_) {
        // Fallback
        return String(Math.floor(100000 + Math.random() * 900000));
    }
}

function requireAuth(req, res, next) {
    try {
        let token = null;
        const auth = req.header('authorization') || req.header('Authorization');
        if (auth && auth.toLowerCase().startsWith('bearer ')) {
            token = auth.substring(7).trim();
        } else {
            token = getTokenFromCookie(req);
        }
        if (!token) return res.status(401).json({ ok: false, error: 'auth_required' });
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ ok: false, error: 'auth_invalid' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    next();
}

// SQLite is initialized in db.js

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Health check for connection manager (HEAD method)
app.head('/api/health', (req, res) => {
    res.status(200).end();
});

// Auth routes
// New register: store in pending_users until code is confirmed
app.post('/api/auth/register', [
    body('name').trim().isLength({ min: 2 }).withMessage('name'),
    body('email').isEmail().withMessage('email'),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[\W_]).+$/).withMessage('password')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    }
    const { name, email, password } = req.body;
    const existsUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existsUser) return res.status(409).json({ ok: false, error: 'email_exists' });
    const existsPending = db.prepare('SELECT id FROM pending_users WHERE email = ?').get(email);
    const hash = bcrypt.hashSync(password, 10);
    const code = generateCode6();
    const expires = new Date(Date.now() + 24*60*60*1000).toISOString();
    if (existsPending) {
        db.prepare('UPDATE pending_users SET name=?, password_hash=?, code=?, expires_at=? WHERE email=?').run(name, hash, code, expires, email);
    } else {
        db.prepare('INSERT INTO pending_users (name, email, password_hash, code, expires_at) VALUES (?, ?, ?, ?, ?)')
          .run(name, email, hash, code, expires);
    }
    // Dev ortamında kolay test için konsola yaz
    if ((process.env.NODE_ENV || 'development') !== 'production') {
        console.log('DEBUG REGISTER CODE:', email, code);
    }
    sendMailSafe({ to: email, subject: 'Keyco - E-posta Doğrulama Kodu', text: `Doğrulama kodunuz: ${code}. Bu kod 24 saat geçerlidir.` });
    res.json({ ok: true, message: 'verification_required' });
});

// Confirm registration code -> create real user and sign in
app.post('/api/auth/register/confirm', [ body('email').isEmail(), body('code').isLength({ min: 6, max: 6 }) ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { email, code } = req.body;
    const row = db.prepare('SELECT id, name, email, password_hash, code AS pcode, expires_at FROM pending_users WHERE email = ?').get(email);
    if (!row) return res.status(400).json({ ok: false, error: 'invalid_email' });
    if (row.pcode !== String(code)) return res.status(400).json({ ok: false, error: 'invalid_code' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ ok: false, error: 'expired_code' });
    const info = db.prepare('INSERT INTO users (name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, 1)')
        .run(row.name, row.email, row.password_hash, 'user');
    db.prepare('DELETE FROM pending_users WHERE id = ?').run(row.id);
    const user = { id: info.lastInsertRowid, name: row.name, email: row.email, role: 'user' };
    const jwtToken = signToken(user);
    const oneWeek = 7 * 24 * 60 * 60;
    res.setHeader('Set-Cookie', `token=${encodeURIComponent(jwtToken)}; Max-Age=${oneWeek}; Path=/; HttpOnly; SameSite=Lax`);
    res.json({ ok: true, user, token: jwtToken });
});

// Resend code for pending registration
app.post('/api/auth/register/resend-code', [ body('email').isEmail() ], (req, res) => {
    const { email } = req.body;
    const row = db.prepare('SELECT id FROM pending_users WHERE email = ?').get(email);
    if (!row) return res.json({ ok: true });
    const code = generateCode6();
    const expires = new Date(Date.now() + 24*60*60*1000).toISOString();
    db.prepare('UPDATE pending_users SET code=?, expires_at=? WHERE id=?').run(code, expires, row.id);
    if ((process.env.NODE_ENV || 'development') !== 'production') {
        console.log('DEBUG REGISTER CODE (RESEND):', email, code);
    }
    sendMailSafe({ to: email, subject: 'Keyco - Doğrulama Kodu (Yeniden)', text: `Kodunuz: ${code}` });
    res.json({ ok: true });
});

app.post('/api/auth/login', [
    body('email').isEmail().withMessage('email'),
    body('password').isLength({ min: 6 }).withMessage('password')
], (req, res) => {
    console.log('=== LOGIN REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Login validation errors:', errors.array());
        return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    }
    const { email, password } = req.body || {};
    const row = db.prepare('SELECT id, name, email, password_hash, role, email_verified FROM users WHERE email = ?').get(email);
    if (!row) return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    if (!row.email_verified) return res.status(403).json({ ok: false, error: 'email_not_verified' });
    // Always start with OTP on first login
    // Generate OTP and send via email
    const code = generateCode6();
    const expires = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO auth_tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)').run(row.id, code, 'login_otp', expires);
    try {
        sendMailSafe({ to: row.email, subject: 'Keyco - Giriş Doğrulama Kodu', text: `Giriş doğrulama kodunuz: ${code}. Kod 2 dakika boyunca geçerlidir.` });
    } catch (_) {}
    if ((process.env.NODE_ENV || 'development') !== 'production') {
        console.log('DEBUG LOGIN OTP:', row.email, code);
    }
    console.log('Login successful, OTP sent to:', row.email);
    res.json({ ok: true, step: 'otp_required' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ ok: true, user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
    // Clear cookie
    res.setHeader('Set-Cookie', 'token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    res.json({ ok: true });
});

// Email verification via code
app.post('/api/auth/verify/code', [ body('email').isEmail(), body('code').isLength({ min: 6, max: 6 }) ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { email, code } = req.body;
    const user = db.prepare('SELECT id, name, email, role, email_verified FROM users WHERE email = ?').get(email);
    if (!user) return res.status(400).json({ ok: false, error: 'invalid_email' });
    if (user.email_verified) {
        const tokenExisting = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
        const oneWeek = 7 * 24 * 60 * 60;
        res.setHeader('Set-Cookie', `token=${encodeURIComponent(tokenExisting)}; Max-Age=${oneWeek}; Path=/; HttpOnly; SameSite=Lax`);
        return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role }, token: tokenExisting });
    }
    const tokenRow = db.prepare('SELECT id, expires_at, used FROM auth_tokens WHERE user_id = ? AND type = ? AND token = ? ORDER BY id DESC').get(user.id, 'verify', String(code));
    if (!tokenRow) return res.status(400).json({ ok: false, error: 'invalid_code' });
    if (tokenRow.used) return res.status(400).json({ ok: false, error: 'used_code' });
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) return res.status(400).json({ ok: false, error: 'expired_code' });
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(user.id);
    db.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').run(tokenRow.id);
    const jwtToken = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    const oneWeek = 7 * 24 * 60 * 60;
    res.setHeader('Set-Cookie', `token=${encodeURIComponent(jwtToken)}; Max-Age=${oneWeek}; Path=/; HttpOnly; SameSite=Lax`);
    res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role }, token: jwtToken });
});

// Resend verification code
app.post('/api/auth/verify/resend-code', [ body('email').isEmail() ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { email } = req.body;
    const user = db.prepare('SELECT id, email_verified FROM users WHERE email = ?').get(email);
    if (!user) return res.json({ ok: true });
    if (user.email_verified) return res.json({ ok: true });
    const code = generateCode6();
    const expires = new Date(Date.now() + 24*60*60*1000).toISOString();
    db.prepare('INSERT INTO auth_tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)').run(user.id, code, 'verify', expires);
    try { sendMailSafe({ to: email, subject: 'Keyco - Doğrulama Kodu (Yeniden)', text: `Kodunuz: ${code}` }); } catch (_) {}
    res.json({ ok: true });
});

// Login OTP verify
app.post('/api/auth/login/verify-otp', [ body('email').isEmail(), body('code').isLength({ min: 6, max: 6 }) ], (req, res) => {
    console.log('=== OTP VERIFICATION REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ 
                ok: false, 
                error: 'validation_failed',
                details: errors.array().map(e => ({ field: e.param, message: e.msg }))
            });
        }
        
        const { email, code } = req.body;
        console.log('OTP verification attempt:', { email, code: code ? '***' : 'undefined' });
        
        const row = db.prepare('SELECT id, name, email, role, email_verified FROM users WHERE email = ?').get(email);
        if (!row) {
            console.log('User not found for email:', email);
            return res.status(401).json({ ok: false, error: 'invalid_credentials' });
        }
        if (!row.email_verified) {
            console.log('Email not verified for user:', email);
            return res.status(403).json({ ok: false, error: 'email_not_verified' });
        }
        
        const tokenRow = db.prepare('SELECT id, expires_at, used FROM auth_tokens WHERE user_id = ? AND type = ? AND token = ? ORDER BY id DESC').get(row.id, 'login_otp', String(code));
        console.log('Database query result:', tokenRow);
        console.log('Looking for OTP code:', String(code), 'for user:', row.id);
        
        if (!tokenRow) {
            console.log('Invalid OTP code for user:', row.id, 'code:', code);
            // Let's check what tokens exist for this user
            const existingTokens = db.prepare('SELECT token, used, expires_at FROM auth_tokens WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 5').all(row.id, 'login_otp');
            console.log('Existing OTP tokens for user:', existingTokens);
            return res.status(400).json({ ok: false, error: 'invalid_code' });
        }
        if (tokenRow.used) {
            console.log('OTP code already used for user:', row.id);
            return res.status(400).json({ ok: false, error: 'used_code' });
        }
        if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
            console.log('OTP code expired for user:', row.id, 'expires:', tokenRow.expires_at);
            return res.status(400).json({ ok: false, error: 'expired_code' });
        }
        
        // Mark token as used
        db.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').run(tokenRow.id);
        
        // Create user object and JWT token
        const user = { id: row.id, name: row.name, email: row.email, role: row.role, email_verified: 1 };
        const jwtToken = signToken(user, '15d');
        const oneWeek = 15 * 24 * 60 * 60;
        
        console.log('OTP verification successful for user:', row.id);
        
        // Set cookie and send response
        res.setHeader('Set-Cookie', `token=${encodeURIComponent(jwtToken)}; Max-Age=${oneWeek}; Path=/; HttpOnly; SameSite=Lax`);
        res.status(200).json({ ok: true, user, token: jwtToken });
        
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ ok: false, error: 'internal_server_error' });
    }
});

// Login OTP resend
app.post('/api/auth/login/resend-otp', [ body('email').isEmail() ], (req, res) => {
    console.log('=== OTP RESEND REQUEST ===');
    console.log('Request body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { email } = req.body;
    const row = db.prepare('SELECT id, email_verified FROM users WHERE email = ?').get(email);
    if (!row) return res.json({ ok: true });
    if (!row.email_verified) return res.status(403).json({ ok: false, error: 'email_not_verified' });
    
    // Mark all existing OTP tokens as used for this user
    db.prepare('UPDATE auth_tokens SET used = 1 WHERE user_id = ? AND type = ? AND used = 0').run(row.id, 'login_otp');
    
    const code = generateCode6();
    const expires = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO auth_tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)').run(row.id, code, 'login_otp', expires);
    
    try { 
        sendMailSafe({ to: email, subject: 'Keyco - Giriş Doğrulama Kodu (Yeniden)', text: `Kodunuz: ${code}. Kod 2 dakika boyunca geçerlidir.` }); 
    } catch (_) {}
    
    console.log('New OTP sent to:', email, 'code:', code);
    res.json({ ok: true });
});

// Resend verification email
app.post('/api/auth/verify/resend', [ body('email').isEmail().withMessage('email') ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { email } = req.body;
    const row = db.prepare('SELECT id, email_verified FROM users WHERE email = ?').get(email);
    if (!row) return res.json({ ok: true });
    if (row.email_verified) return res.json({ ok: true });
    try {
        const tokenStr = require('crypto').randomBytes(24).toString('hex');
        const expires = new Date(Date.now() + 24*60*60*1000).toISOString();
        db.prepare('INSERT INTO auth_tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)').run(row.id, tokenStr, 'verify', expires);
        sendMailSafe({
            to: email,
            subject: 'Keyco - E-posta Doğrulama (Yeniden)',
            text: `Hesabınızı doğrulamak için linke tıklayın: http://localhost:${PORT}/api/auth/verify?token=${tokenStr}`
        });
    } catch (_) {}
    res.json({ ok: true });
});

// Email verification
app.get('/api/auth/verify', (req, res) => {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).send('Invalid token');
    const row = db.prepare('SELECT id, user_id, expires_at, used FROM auth_tokens WHERE token = ? AND type = ?').get(token, 'verify');
    if (!row) return res.status(400).send('Invalid token');
    if (row.used) return res.status(400).send('Token used');
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).send('Token expired');
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id);
    db.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').run(row.id);
    res.redirect('/verify.html?ok=1');
});

// Password reset request
app.post('/api/auth/reset/request', [ body('email').isEmail().withMessage('email') ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { email } = req.body;
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) return res.json({ ok: true }); // don't leak existence
    try {
        const tokenStr = require('crypto').randomBytes(24).toString('hex');
        const expires = new Date(Date.now() + 30*60*1000).toISOString();
        db.prepare('INSERT INTO auth_tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)').run(user.id, tokenStr, 'reset', expires);
        sendMailSafe({
            to: email,
            subject: 'Keyco - Şifre Sıfırlama',
            text: `Şifrenizi sıfırlamak için linke tıklayın: http://localhost:${PORT}/reset?token=${tokenStr}`
        });
    } catch (_) {}
    res.json({ ok: true });
});

// Password reset perform
app.post('/api/auth/reset/perform', [ body('token').isString(), body('password').isLength({ min: 6 }) ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { token, password } = req.body;
    const row = db.prepare('SELECT id, user_id, expires_at, used FROM auth_tokens WHERE token = ? AND type = ?').get(token, 'reset');
    if (!row) return res.status(400).json({ ok: false, error: 'invalid_token' });
    if (row.used) return res.status(400).json({ ok: false, error: 'used_token' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ ok: false, error: 'expired_token' });
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
    db.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').run(row.id);
    res.json({ ok: true });
});

// Profile: change password (send code to own email) - requires auth
app.post('/api/profile/change-password/request', requireAuth, (req, res) => {
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(401).json({ ok: false, error: 'unknown_user' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO auth_tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)').run(user.id, code, 'change_pwd', expires);
    try { sendMailSafe({ to: user.email, subject: 'Keyco - Şifre Değiştirme Kodu', text: `Kodunuz: ${code} (10 dk geçerli)` }); } catch (_) {}
    res.json({ ok: true });
});

// Profile: get user info
app.get('/api/profile', requireAuth, (req, res) => {
    const user = db.prepare('SELECT id, name, email, role, email_verified, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user_not_found' });
    res.json({ ok: true, user });
});

// Profile: update name
app.put('/api/profile/name', requireAuth, [ body('name').isLength({ min: 2 }) ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { name } = req.body;
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
    res.json({ ok: true });
});

// Profile: request email change (send 6-digit code to OLD email, store new email pending)
app.post('/api/profile/email/request', requireAuth, [ body('email').isEmail() ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { email: newEmail } = req.body;
    // Save pending change (overwrite if exists)
    const code = generateCode6();
    const expires = new Date(Date.now() + 30*60*1000).toISOString(); // 30 minutes
    const exists = db.prepare('SELECT id FROM pending_email_changes WHERE user_id = ?').get(req.user.id);
    if (exists) {
        db.prepare('UPDATE pending_email_changes SET new_email=?, code=?, expires_at=?, used=0 WHERE user_id=?').run(newEmail, code, expires, req.user.id);
    } else {
        db.prepare('INSERT INTO pending_email_changes (user_id, new_email, code, expires_at) VALUES (?, ?, ?, ?)').run(req.user.id, newEmail, code, expires);
    }
    // Send code to OLD email (current account email)
    try {
        const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
        if (user?.email) {
            sendMailSafe({ to: user.email, subject: 'Keyco - E‑posta Değişiklik Kodu', text: `E‑posta değişikliği için doğrulama kodunuz: ${code}. Kod 30 dakika geçerlidir.` });
        }
    } catch {}
    if ((process.env.NODE_ENV || 'development') !== 'production') {
        console.log('DEBUG EMAIL CHANGE CODE:', req.user.email, code, '-> new:', newEmail);
    }
    res.json({ ok: true });
});

// Profile: confirm email change with code
app.post('/api/profile/email/confirm', requireAuth, [ body('code').isLength({ min: 6, max: 6 }) ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { code } = req.body;
    const row = db.prepare('SELECT id, new_email, expires_at, used FROM pending_email_changes WHERE user_id = ?').get(req.user.id);
    if (!row) return res.status(400).json({ ok: false, error: 'no_request' });
    if (row.used) return res.status(400).json({ ok: false, error: 'used_code' });
    if (String(row.code) !== String(code)) return res.status(400).json({ ok: false, error: 'invalid_code' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ ok: false, error: 'expired_code' });
    try {
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(row.new_email, req.user.id);
        db.prepare('UPDATE pending_email_changes SET used = 1 WHERE id = ?').run(row.id);
    } catch (e) {
        if (String(e.message||'').includes('UNIQUE')) return res.status(409).json({ ok: false, error: 'email_exists' });
        throw e;
    }
    res.json({ ok: true });
});
app.post('/api/profile/change-password/perform', requireAuth, [ body('code').isLength({ min: 6, max: 6 }), body('newPassword').isLength({ min: 6 }) ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { code, newPassword } = req.body;
    const tokenRow = db.prepare('SELECT id, expires_at, used FROM auth_tokens WHERE user_id = ? AND type = ? AND token = ? ORDER BY id DESC').get(req.user.id, 'change_pwd', String(code));
    if (!tokenRow) return res.status(400).json({ ok: false, error: 'invalid_code' });
    if (tokenRow.used) return res.status(400).json({ ok: false, error: 'used_code' });
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) return res.status(400).json({ ok: false, error: 'expired_code' });
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    db.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').run(tokenRow.id);
    res.json({ ok: true });
});

// Get product categories and platforms
app.get('/api/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category').all();
        const platforms = db.prepare('SELECT DISTINCT platform FROM products WHERE platform IS NOT NULL ORDER BY platform').all();
        const packageLevels = db.prepare('SELECT DISTINCT package_level FROM products WHERE package_level IS NOT NULL ORDER BY package_level').all();
        
        res.json({ 
            ok: true, 
            categories: categories.map(c => c.category),
            platforms: platforms.map(p => p.platform),
            packageLevels: packageLevels.map(p => p.package_level)
        });
    } catch (error) {
        console.error('Categories query error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Admin products endpoint
app.get('/api/admin/products', requireAuth, requireAdmin, (req, res) => {
    try {
        // Check if products table has any data
        const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
        
        if (count.count === 0) {
            return res.json({ ok: true, items: [], total: 0 });
        }
        
        const query = `
            SELECT 
                p.id, p.name, p.slug, p.price, p.currency, p.category, p.platform, 
                p.package_level, p.description, p.discount, p.created_at,
                COUNT(pc.id) as total_codes,
                COUNT(CASE WHEN pc.is_used = 0 THEN 1 END) as available_codes
            FROM products p
            LEFT JOIN product_codes pc ON p.id = pc.product_id
            GROUP BY p.id
            ORDER BY p.id DESC
        `;
        const rows = db.prepare(query).all();
        res.json({ ok: true, items: rows, total: rows.length });
    } catch (error) {
        console.error('Admin products query error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Public products endpoint
app.get('/api/products', (req, res) => {
    const { search, category, min_price, max_price, platform, sort_by, sort_order, package_level } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    // Search filter (name, description, description_en, slug)
    if (search && search.trim()) {
        whereClause += ` AND (name LIKE ? OR description LIKE ? OR description_en LIKE ? OR slug LIKE ?)`;
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Category filter
    if (category && category !== 'all') {
        whereClause += ` AND category = ?`;
        params.push(category);
    }
    
    // Platform filter
    if (platform && platform !== 'all') {
        whereClause += ` AND platform = ?`;
        params.push(platform);
    }
    
    // Package level filter
    if (package_level && package_level !== 'all') {
        whereClause += ` AND package_level = ?`;
        params.push(package_level);
    }
    
    // Price range filter
    if (min_price && !isNaN(min_price)) {
        whereClause += ` AND price >= ?`;
        params.push(parseInt(min_price));
    }
    
    if (max_price && !isNaN(max_price)) {
        whereClause += ` AND price <= ?`;
        params.push(parseInt(max_price));
    }
    
    // Price range filter (alternative format: "0-50", "50-100", etc.)
    if (req.query.price_range && req.query.price_range.includes('-')) {
        const [min, max] = req.query.price_range.split('-');
        if (min && !isNaN(min)) {
            whereClause += ` AND price >= ?`;
            params.push(parseInt(min));
        }
        if (max && !isNaN(max)) {
            whereClause += ` AND price <= ?`;
            params.push(parseInt(max));
        }
    }
    
    // Sorting
    let orderClause = 'ORDER BY id DESC';
    if (sort_by && ['name', 'price', 'created_at'].includes(sort_by)) {
        const order = sort_order === 'asc' ? 'ASC' : 'DESC';
        orderClause = `ORDER BY ${sort_by} ${order}`;
    }
    
    const query = `
        SELECT id, name, slug, price, currency, category, platform, package_level, description, description_en, discount, image_url, created_at
        FROM products
        ${whereClause}
        ${orderClause}
    `;
    
    try {
        const rows = db.prepare(query).all(...params);
        res.json({ ok: true, items: rows, total: rows.length });
    } catch (error) {
        console.error('Products query error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.post('/api/products', requireAuth, requireAdmin, [
    body('name').trim().isLength({ min: 2 }).withMessage('name'),
    body('slug').trim().isLength({ min: 2 }).withMessage('slug'),
    body('price').isInt({ min: 0 }).withMessage('price')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const { name, slug, description, price, currency = 'TRY', category, platform, package_level, discount = 0 } = req.body;
    try {
        // Insert into products table
        const info = db.prepare('INSERT INTO products (name, slug, description, price, currency, category, platform, package_level, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(name, slug, description || null, price, currency, category || null, platform || null, package_level || null, discount);
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
        
        // Optionally add to featured products only when requested
        if (req.body && req.body.add_to_featured === true) {
            try {
                const maxOrder = db.prepare('SELECT MAX(display_order) as max_order FROM featured_products').get();
                const nextOrder = (maxOrder?.max_order || 0) + 1;
                // Convert price from kuruş to TL for featured products
                const priceInTL = price / 100;
                db.prepare('INSERT INTO featured_products (name, platform, price, discount, badge, icon, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
                    .run(name, platform || 'Steam', priceInTL, discount, 'new', 'fas fa-plus', nextOrder);
            } catch (featuredError) {
                console.log('Could not add to featured products:', featuredError.message);
            }
        }
        
        res.json({ ok: true, product });
    } catch (e) {
        if (String(e.message || '').includes('UNIQUE constraint failed')) {
            return res.status(409).json({ ok: false, error: 'slug_exists' });
        }
        throw e;
    }
});

app.put('/api/products/:id', requireAuth, requireAdmin, [
    body('name').optional().isLength({ min: 2 }).withMessage('name'),
    body('price').optional().isInt({ min: 0 }).withMessage('price')
], (req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!cur) return res.status(404).json({ ok: false, error: 'not_found' });
    const { name = cur.name, slug = cur.slug, description = cur.description, price = cur.price, currency = cur.currency, category = cur.category, platform = cur.platform, package_level = cur.package_level, discount = cur.discount } = req.body || {};
    try {
        db.prepare('UPDATE products SET name=?, slug=?, description=?, price=?, currency=?, category=?, platform=?, package_level=?, discount=? WHERE id = ?')
          .run(name, slug, description, price, currency, category, platform, package_level, discount, id);
        const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        res.json({ ok: true, product: updated });
    } catch (e) {
        if (String(e.message || '').includes('UNIQUE constraint failed')) {
            return res.status(409).json({ ok: false, error: 'slug_exists' });
        }
        throw e;
    }
});

app.delete('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!cur) return res.status(404).json({ ok: false, error: 'not_found' });
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ ok: true });
});

// Orders
app.post('/api/orders', requireAuth, [ 
    body('items').isArray({ min: 1 }).withMessage('items')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const items = req.body.items;
    // items: [{ product_id, quantity }]
    const products = db.prepare('SELECT id, price FROM products WHERE id IN (' + items.map(() => '?').join(',') + ')').all(items.map(i => i.product_id));
    const priceMap = new Map(products.map(p => [p.id, p.price]));
    let total = 0;
    for (const it of items) {
        const unit = priceMap.get(it.product_id);
        if (!unit) return res.status(400).json({ ok: false, error: 'invalid_product' });
        const qty = Math.max(1, Number(it.quantity || 1));
        total += unit * qty;
    }
    const info = db.prepare('INSERT INTO orders (user_id, total_price, currency, status) VALUES (?, ?, ?, ?)')
        .run(req.user.id, total, 'TRY', 'pending');
    const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
    for (const it of items) {
        const unit = priceMap.get(it.product_id);
        const qty = Math.max(1, Number(it.quantity || 1));
        insItem.run(info.lastInsertRowid, it.product_id, qty, unit);
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ ok: true, order, items: orderItems });
});

app.get('/api/orders', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
    res.json(rows);
});

// Order tracking
// Test notification creation (for development)
app.post('/api/notifications/test', requireAuth, (req, res) => {
    try {
        const notifications = [
            {
                type: 'order_status',
                title: 'Sipariş Durumu Güncellendi',
                message: 'Siparişiniz hazırlanıyor ve yakında gönderilecek.',
                related_id: 1
            },
            {
                type: 'discount',
                title: 'Özel İndirim Fırsatı!',
                message: '%20 indirim kuponu hesabınıza tanımlandı. Kod: WELCOME20',
                related_id: null
            },
            {
                type: 'system',
                title: 'Hoş Geldiniz!',
                message: 'Keyco Gaming Store\'a hoş geldiniz. Yeni özelliklerimizi keşfedin.',
                related_id: null
            }
        ];
        
        const stmt = db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, related_id)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        notifications.forEach(notification => {
            stmt.run(
                req.user.id,
                notification.type,
                notification.title,
                notification.message,
                notification.related_id
            );
        });
        
        res.json({ ok: true, message: 'Test notifications created' });
    } catch (error) {
        console.error('Test notifications error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.get('/api/orders/:id/tracking', requireAuth, (req, res) => {
    const orderId = Number(req.params.id);
    
    try {
        // Check if user owns this order
        const order = db.prepare('SELECT id, status FROM orders WHERE id = ? AND user_id = ?').get(orderId, req.user.id);
        if (!order) {
            return res.status(404).json({ ok: false, error: 'order_not_found' });
        }
        
        const tracking = db.prepare(`
            SELECT status, message, created_at
            FROM order_tracking
            WHERE order_id = ?
            ORDER BY created_at ASC
        `).all(orderId);
        
        res.json({
            ok: true,
            order_status: order.status,
            tracking_history: tracking
        });
        
    } catch (error) {
        console.error('Order tracking error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Payments skeleton
app.post('/api/payments/create', requireAuth, [
    body('order_id').isInt({ min: 1 }).withMessage('order_id')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const orderId = Number(req.body.order_id);
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, req.user.id);
    if (!order) return res.status(404).json({ ok: false, error: 'order_not_found' });

    // Create payment row
    const info = db.prepare(`
        INSERT INTO payments (order_id, user_id, provider, amount, currency, status)
        VALUES (?, ?, 'iyzico', ?, ?, 'initiated')
    `).run(order.id, req.user.id, order.total_price, order.currency);

    const paymentId = info.lastInsertRowid;

    try {
        if (!HAS_IYZIPAY) {
            // Fallback to mock when iyzico not configured
            return res.json({ ok: true, payment_id: paymentId, provider: 'mock', next_action: { type: 'none' } });
        }
        // Build iyzico checkout form request (simplified)
        const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
        const basketItems = db.prepare(`
            SELECT oi.product_id as id, p.name as name, (oi.unit_price * oi.quantity) as price
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = ?
        `).all(order.id).map((it, idx) => ({
            id: String(it.id),
            name: it.name || `Item ${idx+1}`,
            category1: 'Dijital',
            itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
            price: (it.price / 100).toFixed(2)
        }));

        const callbackUrl = `${req.protocol}://${req.get('host')}/api/payments/verify`;
        const request = {
            locale: Iyzipay.LOCALE.TR,
            conversationId: String(paymentId),
            price: (order.total_price / 100).toFixed(2),
            paidPrice: (order.total_price / 100).toFixed(2),
            currency: Iyzipay.CURRENCY.TRY,
            basketId: String(order.id),
            paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
            callbackUrl,
            buyer: {
                id: String(user.id),
                name: user.name || 'User',
                surname: user.name || 'User',
                email: user.email,
                identityNumber: '11111111111',
                registrationAddress: 'Turkey',
                ip: req.ip,
                city: 'Istanbul',
                country: 'Turkey'
            },
            shippingAddress: {
                contactName: user.name || 'User',
                city: 'Istanbul',
                country: 'Turkey',
                address: 'Digital delivery'
            },
            billingAddress: {
                contactName: user.name || 'User',
                city: 'Istanbul',
                country: 'Turkey',
                address: 'Digital delivery'
            },
            basketItems
        };

        iyzico.checkoutFormInitialize.create(request, (err, result) => {
            if (err) {
                console.error('iyzico init error:', err);
                return res.status(500).json({ ok: false, error: 'payment_provider_error' });
            }
            // Save token/external id
            try {
                db.prepare('UPDATE payments SET external_id = ?, status = ? WHERE id = ?')
                  .run(result?.token || null, 'processing', paymentId);
            } catch (_) {}
            res.json({ ok: true, payment_id: paymentId, provider: 'iyzico', checkoutFormContent: result?.checkoutFormContent || null, token: result?.token || null });
        });
    } catch (e) {
        console.error('iyzico init exception:', e);
        return res.status(500).json({ ok: false, error: 'payment_init_failed' });
    }
});

// iyzico callback (server-to-server verify)
app.post('/api/payments/verify', (req, res) => {
    try {
        const { token, conversationId } = req.body || {};
        if (!token) return res.status(400).json({ ok: false, error: 'missing_token' });
        iyzico.checkoutFormRetrieve.create({ locale: Iyzipay.LOCALE.TR, token }, (err, result) => {
            if (err) {
                console.error('iyzico retrieve error:', err);
                return res.status(500).json({ ok: false });
            }
            const status = result?.paymentStatus === 'SUCCESS' ? 'succeeded' : 'failed';
            const paymentRow = db.prepare('SELECT * FROM payments WHERE external_id = ? OR id = ?').get(token, Number(conversationId || 0));
            if (!paymentRow) return res.status(404).json({ ok: false });
            db.prepare('UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, paymentRow.id);
            if (status === 'succeeded') {
                db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', paymentRow.order_id);
                db.prepare('INSERT INTO order_tracking (order_id, status, message) VALUES (?, ?, ?)')
                  .run(paymentRow.order_id, 'processing', 'İyzico ödemesi onaylandı');

                // Send email if SMTP configured
                try {
                    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
                    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
                        const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(paymentRow.user_id);
                        const transporter = nodemailer.createTransport({
                            host: SMTP_HOST,
                            port: Number(SMTP_PORT),
                            secure: Number(SMTP_PORT) === 465,
                            auth: { user: SMTP_USER, pass: SMTP_PASS },
                            tls: { rejectUnauthorized: false }
                        });
                        // Deliver digital codes if available
                        try {
                            fulfillDigitalCodes(paymentRow.order_id);
                        } catch (fe) {
                            console.warn('Code fulfillment failed:', fe.message);
                        }

                        const mailOptions = {
                            from: SMTP_FROM || SMTP_USER,
                            to: user?.email,
                            subject: 'Ödeme Onayı - Keyco',
                            text: `Merhaba ${user?.name || ''},\n\nÖdemeniz başarıyla alındı. Sipariş #${paymentRow.order_id} işleme alındı. Kodlarınız (varsa) hesabınıza tanımlandı ve bu e-postaya eklendi.\n\nTeşekkürler.\nKeyco`
                        };
                        transporter.sendMail(mailOptions).catch(() => {});
                    }
                } catch (_) {}
            }
            // Iyzi expects 200 OK
            res.json({ ok: true });
        });
    } catch (e) {
        console.error('verify exception:', e);
        res.status(500).json({ ok: false });
    }
});

// Public webhook endpoint (provider -> server)
app.post('/api/payments/webhook', (req, res) => {
    try {
        const { external_id, status, amount, currency } = req.body || {};
        if (!external_id) return res.status(400).json({ ok: false });
        const payment = db.prepare('SELECT * FROM payments WHERE external_id = ?').get(external_id);
        if (!payment) return res.status(404).json({ ok: false });

        db.prepare('UPDATE payments SET status = ?, amount = COALESCE(?, amount), currency = COALESCE(?, currency), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(status || 'processing', amount || null, currency || null, payment.id);

        if (status === 'succeeded') {
            db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', payment.order_id);
            db.prepare('INSERT INTO order_tracking (order_id, status, message) VALUES (?, ?, ?)')
              .run(payment.order_id, 'processing', 'Ödeme webhook ile doğrulandı.');
        }
        res.json({ ok: true });
    } catch (e) {
        console.error('Webhook error:', e);
        res.status(500).json({ ok: false });
    }
});

// Admin: list payments
app.get('/api/admin/payments', requireAuth, requireAdmin, (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT 
                p.id, p.order_id, p.user_id, p.provider, p.external_id, p.amount, p.currency, p.status, p.created_at,
                u.email AS user_email, u.name AS user_name,
                o.status AS order_status
            FROM payments p
            LEFT JOIN users u ON u.id = p.user_id
            LEFT JOIN orders o ON o.id = p.order_id
            ORDER BY p.id DESC
        `).all();
        res.json({ ok: true, items: rows, total: rows.length });
    } catch (error) {
        console.error('Admin payments list error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Admin: list payments by order
app.get('/api/admin/orders/:id/payments', requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    try {
        const rows = db.prepare(`
            SELECT id, order_id, user_id, provider, external_id, amount, currency, status, created_at
            FROM payments
            WHERE order_id = ?
            ORDER BY id DESC
        `).all(id);
        res.json({ ok: true, items: rows, total: rows.length });
    } catch (error) {
        console.error('Admin order payments error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});
// Admin: list contacts
app.get('/api/admin/contacts', requireAuth, requireAdmin, (req, res) => {
    try {
        // Check if contacts table has any data
        const count = db.prepare('SELECT COUNT(*) as count FROM contacts').get();
        
        if (count.count === 0) {
            return res.json({ ok: true, items: [], total: 0 });
        }
        
        const rows = db.prepare('SELECT id, name, email, subject, message, created_at FROM contacts ORDER BY id DESC').all();
        res.json({ ok: true, items: rows, total: rows.length });
    } catch (error) {
        console.error('Contacts fetch error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.delete('/api/admin/contacts/:id', requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const exists = db.prepare('SELECT id FROM contacts WHERE id = ?').get(id);
    console.log('Admin delete contact attempt', { id, exists: !!exists });
    if (!exists) return res.status(404).json({ ok: false, error: 'not_found' });
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
    res.json({ ok: true });
});

// Admin: list all orders
app.get('/api/admin/orders', requireAuth, requireAdmin, (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT o.id, o.user_id, u.name as user_name, u.email as user_email, 
                   o.total_price, o.currency, o.status, o.created_at 
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            ORDER BY o.id DESC
        `).all();
        
        res.json({ ok: true, items: rows, total: rows.length });
    } catch (error) {
        console.error('Orders fetch error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Admin: get items of an order
app.get('/api/admin/orders/:id/items', requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const items = db.prepare('SELECT id, order_id, product_id, quantity, unit_price FROM order_items WHERE order_id = ?').all(id);
    res.json(items);
});

// Admin: product codes CRUD
app.get('/api/admin/products/:id/codes', requireAuth, requireAdmin, (req, res) => {
    const productId = Number(req.params.id);
    const rows = db.prepare('SELECT id, code, is_used, used_at, created_at FROM product_codes WHERE product_id = ? ORDER BY id DESC').all(productId);
    res.json({ ok: true, items: rows, total: rows.length });
});

app.post('/api/admin/products/:id/codes', requireAuth, requireAdmin, [
    body('codes').isArray({ min: 1 }).withMessage('codes')
], (req, res) => {
    const productId = Number(req.params.id);
    const { codes } = req.body || {};
    const ins = db.prepare('INSERT OR IGNORE INTO product_codes (product_id, code) VALUES (?, ?)');
    let inserted = 0;
    for (const c of codes) {
        if (typeof c === 'string' && c.trim()) {
            const info = ins.run(productId, c.trim());
            if (info.changes > 0) inserted++;
        }
    }
    res.json({ ok: true, inserted });
});

app.delete('/api/admin/products/:id/codes/:codeId', requireAuth, requireAdmin, (req, res) => {
    const productId = Number(req.params.id);
    const codeId = Number(req.params.codeId);
    const row = db.prepare('SELECT id, is_used FROM product_codes WHERE id = ? AND product_id = ?').get(codeId, productId);
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    if (row.is_used) return res.status(400).json({ ok: false, error: 'already_used' });
    db.prepare('DELETE FROM product_codes WHERE id = ?').run(codeId);
    res.json({ ok: true });
});

// User: view delivered codes for an order
app.get('/api/orders/:id/codes', requireAuth, (req, res) => {
    const orderId = Number(req.params.id);
    const own = db.prepare('SELECT 1 FROM orders WHERE id = ? AND user_id = ?').get(orderId, req.user.id);
    if (!own) return res.status(404).json({ ok: false, error: 'order_not_found' });
    const rows = db.prepare(`
        SELECT oic.order_item_id, oic.product_id, oic.code, p.name AS product_name
        FROM order_item_codes oic
        LEFT JOIN products p ON p.id = oic.product_id
        WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.id = oic.order_item_id AND oi.order_id = ?)
        ORDER BY oic.id ASC
    `).all(orderId);
    res.json({ ok: true, items: rows, total: rows.length });
});

// Admin: update order status
app.put('/api/admin/orders/:id/status', requireAuth, requireAdmin, [
    body('status').isIn(['pending','processing','paid','shipped','delivered','cancelled']).withMessage('status')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
    const id = Number(req.params.id);
    const { status } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) return res.status(404).json({ ok: false, error: 'not_found' });
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    db.prepare('INSERT INTO order_tracking (order_id, status, message) VALUES (?, ?, ?)')
      .run(id, status, `Durum güncellendi: ${status}`);
    res.json({ ok: true });
});

// Admin: list users
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    const { search, role, verified, date_from, date_to } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    // Search filter (name or email)
    if (search && search.trim()) {
        whereClause += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm);
    }
    
    // Role filter
    if (role && role !== 'all') {
        whereClause += ` AND u.role = ?`;
        params.push(role);
    }
    
    // Verification filter
    if (verified === 'true') {
        whereClause += ` AND u.email_verified = 1`;
    } else if (verified === 'false') {
        whereClause += ` AND u.email_verified = 0`;
    }
    
    // Date range filter
    if (date_from) {
        whereClause += ` AND DATE(u.created_at) >= ?`;
        params.push(date_from);
    }
    
    if (date_to) {
        whereClause += ` AND DATE(u.created_at) <= ?`;
        params.push(date_to);
    }
    
    const query = `
        SELECT u.id, u.name, u.email, u.role, u.email_verified, u.created_at
        FROM users u
        ${whereClause}
        ORDER BY u.id DESC
    `;
    
    try {
        const rows = db.prepare(query).all(...params);
        res.json({ ok: true, items: rows, total: rows.length });
    } catch (error) {
        console.error('Users query error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Favorites API
app.get('/api/favorites', requireAuth, (req, res) => {
    const rows = db.prepare(`
        SELECT p.id, p.name, p.slug, p.description, p.description_en, p.price, p.currency, p.category, p.platform, p.package_level, p.discount, p.image_url, f.created_at AS favorited_at
        FROM favorites f
        JOIN products p ON p.id = f.product_id
        WHERE f.user_id = ?
        ORDER BY f.id DESC
    `).all(req.user.id);
    res.json({ ok: true, items: rows });
});

app.post('/api/favorites/:productId', requireAuth, (req, res) => {
    const productId = Number(req.params.productId);
    const p = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!p) return res.status(404).json({ ok: false, error: 'product_not_found' });
    try {
        db.prepare('INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)').run(req.user.id, productId);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: 'favorite_failed' });
    }
});

app.delete('/api/favorites/:productId', requireAuth, (req, res) => {
    const productId = Number(req.params.productId);
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.user.id, productId);
    res.json({ ok: true });
});

// Cart API
app.get('/api/cart', requireAuth, (req, res) => {
    const rows = db.prepare(`
        SELECT p.id, p.name, p.slug, p.description, p.description_en, p.price, p.currency, p.category, p.platform, p.package_level, p.discount, p.image_url, c.quantity, c.created_at AS added_at
        FROM cart_items c
        JOIN products p ON p.id = c.product_id
        WHERE c.user_id = ?
        ORDER BY c.id DESC
    `).all(req.user.id);
    
    const total = rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ ok: true, items: rows, total });
});

app.post('/api/cart/:productId', requireAuth, (req, res) => {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body.quantity) || 1;
    
    const p = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!p) return res.status(404).json({ ok: false, error: 'product_not_found' });
    
    try {
        db.prepare(`
            INSERT INTO cart_items (user_id, product_id, quantity) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id, product_id) 
            DO UPDATE SET quantity = quantity + ?
        `).run(req.user.id, productId, quantity, quantity);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: 'cart_add_failed' });
    }
});

app.put('/api/cart/:productId', requireAuth, (req, res) => {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body.quantity);
    
    if (quantity <= 0) {
        db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, productId);
    } else {
        db.prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?').run(quantity, req.user.id, productId);
    }
    res.json({ ok: true });
});

app.delete('/api/cart/:productId', requireAuth, (req, res) => {
    const productId = Number(req.params.productId);
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, productId);
    res.json({ ok: true });
});

app.delete('/api/cart', requireAuth, (req, res) => {
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
});

// Product Reviews API
app.get('/api/products/:id/reviews', (req, res) => {
    const productId = Number(req.params.id);
    
    try {
        const reviews = db.prepare(`
            SELECT r.id, r.rating, r.title, r.comment, r.is_verified_purchase, r.created_at,
                   u.name as user_name, u.id as user_id
            FROM product_reviews r
            JOIN users u ON u.id = r.user_id
            WHERE r.product_id = ? AND r.is_approved = 1
            ORDER BY r.created_at DESC
        `).all(productId);
        
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as avg_rating,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
            FROM product_reviews 
            WHERE product_id = ? AND is_approved = 1
        `).get(productId);
        
        res.json({
            ok: true,
            reviews,
            stats: {
                total_reviews: stats.total_reviews || 0,
                avg_rating: stats.avg_rating ? Number(stats.avg_rating).toFixed(1) : 0,
                rating_distribution: {
                    5: stats.five_star || 0,
                    4: stats.four_star || 0,
                    3: stats.three_star || 0,
                    2: stats.two_star || 0,
                    1: stats.one_star || 0
                }
            }
        });
        
    } catch (error) {
        console.error('Product reviews error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.post('/api/products/:id/reviews', requireAuth, (req, res) => {
    const productId = Number(req.params.id);
    const { rating, title, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ ok: false, error: 'invalid_rating' });
    }
    
    try {
        // Check if user already reviewed this product
        const existingReview = db.prepare(`
            SELECT id FROM product_reviews 
            WHERE user_id = ? AND product_id = ?
        `).get(req.user.id, productId);
        
        if (existingReview) {
            return res.status(409).json({ ok: false, error: 'already_reviewed' });
        }
        
        // Check if user has purchased this product (for verified purchase badge)
        const hasPurchase = db.prepare(`
            SELECT 1 FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'
        `).get(req.user.id, productId);
        
        const isVerifiedPurchase = hasPurchase ? 1 : 0;
        
        const result = db.prepare(`
            INSERT INTO product_reviews (product_id, user_id, rating, title, comment, is_verified_purchase)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(productId, req.user.id, rating, title || null, comment || null, isVerifiedPurchase);
        
        res.json({ 
            ok: true, 
            message: 'Yorum başarıyla eklendi',
            review_id: result.lastInsertRowid 
        });
        
    } catch (error) {
        console.error('Add review error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Coupon API
app.post('/api/coupons/validate', (req, res) => {
    console.log('Coupon validation request received:', req.body);
    const { code, order_amount, user_id } = req.body;
    
    if (!code || !order_amount) {
        console.log('Missing required fields:', { code, order_amount });
        return res.json({ ok: false, error: 'missing_info' });
    }
    
    try {
        const coupon = db.prepare(`
            SELECT * FROM coupons 
            WHERE code = ? AND is_active = 1 
            AND (valid_until IS NULL OR valid_until > datetime('now'))
            AND (max_uses = -1 OR used_count < max_uses)
        `).get(code);
        
        if (!coupon) {
            return res.json({ ok: false, error: 'invalid_coupon' });
        }
        // Normalize units to TL (if DB stores in kurus, convert)
        const orderAmountTl = Number(order_amount) || 0;
        const minFromDb = Number(coupon.min_order_amount) || 0;
        const minAmountTl = minFromDb > 1000 ? (minFromDb / 100) : minFromDb;

        if (orderAmountTl < minAmountTl) {
            return res.json({ 
                ok: false, 
                error: 'min_amount_not_met',
                min_amount: minAmountTl 
            });
        }
        
        // Check if user already used this coupon (if user_id provided)
        if (user_id) {
            const alreadyUsed = db.prepare(`
                SELECT 1 FROM coupon_usage 
                WHERE coupon_id = ? AND user_id = ?
            `).get(coupon.id, user_id);
            
            if (alreadyUsed) {
                return res.json({ ok: false, error: 'coupon_already_used' });
            }
        }
        
        // Optional targeting check
        const targetType = coupon.target_type || 'all';
        const targetValues = (coupon.target_values || '').split(',').map(s => s.trim()).filter(Boolean);

        // If client sends cart items, validate targeting
        const cartItems = Array.isArray(req.body.items) ? req.body.items : []; // [{product_id, category, platform, price}]
        if (targetType !== 'all') {
            const matches = cartItems.some(it => {
                if (targetType === 'product') return targetValues.includes(String(it.product_id));
                if (targetType === 'category') return targetValues.includes(String(it.category));
                if (targetType === 'platform') return targetValues.includes(String(it.platform));
                return false;
            });
            if (!matches) {
                return res.json({ ok: false, error: 'coupon_not_applicable' });
            }
        }

        // Calculate discount in TL
        const rawCouponValue = Number(coupon.value) || 0;
        // Normalize fixed coupon value to TL if stored in kuruş
        const couponValue = (coupon.type === 'percentage')
            ? rawCouponValue
            : (rawCouponValue > 1000 ? rawCouponValue / 100 : rawCouponValue);
        let discount_amount = 0;
        if (coupon.type === 'percentage') {
            discount_amount = Math.floor(orderAmountTl * (couponValue / 100));
        } else {
            // fixed amount assumed in TL
            discount_amount = Math.min(couponValue, orderAmountTl);
        }
        
        res.json({
            ok: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
                discount_amount
            }
        });
        
    } catch (error) {
        console.error('Coupon validation error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Notifications API
app.get('/api/notifications', requireAuth, (req, res) => {
    try {
        const notifications = db.prepare(`
            SELECT id, type, title, message, is_read, related_id, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `).all(req.user.id);
        
        const unreadCount = db.prepare(`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = ? AND is_read = 0
        `).get(req.user.id);
        
        res.json({
            ok: true,
            notifications,
            unread_count: unreadCount.count || 0
        });
        
    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.put('/api/notifications/:id/read', requireAuth, (req, res) => {
    const notificationId = Number(req.params.id);
    
    try {
        db.prepare(`
            UPDATE notifications 
            SET is_read = 1 
            WHERE id = ? AND user_id = ?
        `).run(notificationId, req.user.id);
        
        res.json({ ok: true });
        
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.post('/api/notifications/read-all', requireAuth, (req, res) => {
    try {
        db.prepare(`
            UPDATE notifications 
            SET is_read = 1 
            WHERE user_id = ?
        `).run(req.user.id);
        
        res.json({ ok: true });
        
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Admin: Send notification to users
app.post('/api/admin/notifications', requireAuth, requireAdmin, (req, res) => {
    try {
        const { title, message, user_ids, type } = req.body;
        
        if (!title || !message) {
            return res.status(400).json({ ok: false, error: 'missing_info' });
        }
        
        // If no user_ids provided, send to all users
        let targetUsers = [];
        if (user_ids && user_ids.length > 0) {
            targetUsers = db.prepare(`
                SELECT id FROM users WHERE id IN (${user_ids.map(() => '?').join(',')})
            `).all(...user_ids);
        } else {
            targetUsers = db.prepare('SELECT id FROM users').all();
        }
        
        // Insert notifications for each user
        const insertNotification = db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `);
        
        const transaction = db.transaction(() => {
            for (const user of targetUsers) {
                insertNotification.run(user.id, type || 'admin', title, message);
            }
        });
        
        transaction();
        
        res.json({ 
            ok: true, 
            message: `${targetUsers.length} kullanıcıya bildirim gönderildi` 
        });
        
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Admin: Get all notifications
app.get('/api/admin/notifications', requireAuth, requireAdmin, (req, res) => {
    try {
        // Check if notifications table has any data
        const count = db.prepare('SELECT COUNT(*) as count FROM notifications').get();
        
        if (count.count === 0) {
            return res.json({ ok: true, notifications: [] });
        }
        
        const notifications = db.prepare(`
            SELECT n.*, u.name as user_name, u.email as user_email
            FROM notifications n
            LEFT JOIN users u ON u.id = n.user_id
            ORDER BY n.created_at DESC
            LIMIT 100
        `).all();
        
        res.json({ ok: true, notifications });
        
    } catch (error) {
        console.error('Admin notifications fetch error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Admin: delete user (protect admins and self)
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (req.user.id === id) return res.status(400).json({ ok: false, error: 'cannot_delete_self' });
    const u = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
    if (!u) return res.status(404).json({ ok: false, error: 'not_found' });
    if (u.role === 'admin') return res.status(403).json({ ok: false, error: 'cannot_delete_admin' });
    // optional: block if has orders
    const hasOrder = db.prepare('SELECT 1 FROM orders WHERE user_id = ? LIMIT 1').get(id);
    if (hasOrder) return res.status(409).json({ ok: false, error: 'has_orders' });
    db.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ ok: true });
});

// FAQs
app.get('/api/faqs', (req, res) => {
    const rows = db.prepare('SELECT id, q_tr, q_en, a_tr, a_en FROM faqs ORDER BY id').all();
    res.json(rows);
});

// Contact
app.post(
    '/api/contact',
    requireAuth,
    [
        body('name').trim().isLength({ min: 2 }).withMessage('name'),
        body('email').isEmail().withMessage('email'),
        body('message').trim().isLength({ min: 5 }).withMessage('message')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ ok: false, errors: errors.array().map(e => e.param) });
        }
        const stmt = db.prepare('INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)');
        const info = stmt.run(req.body.name, req.body.email, req.body.subject || null, req.body.message);

        // Try to send email if SMTP configured
        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_TO } = process.env;
        if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_TO) {
            const transporter = nodemailer.createTransport({
                host: SMTP_HOST,
                port: Number(SMTP_PORT),
                secure: Number(SMTP_PORT) === 465,
                auth: { user: SMTP_USER, pass: SMTP_PASS },
                tls: { rejectUnauthorized: false }
            });
            try {
                await transporter.verify();
            } catch (err) {
                console.warn('SMTP verify failed:', err.message);
            }
            const mailOptions = {
                from: SMTP_FROM || SMTP_USER,
                to: SMTP_TO,
                subject: `[Keyco] Yeni iletişim mesajı: ${req.body.subject || '-'} (#${info.lastInsertRowid})`,
                text: `Ad: ${req.body.name}\nE-posta: ${req.body.email}\nKonu: ${req.body.subject || '-'}\n\nMesaj:\n${req.body.message}`
            };
            try {
                const result = await transporter.sendMail(mailOptions);
                console.log('Mail sent successfully:', result.messageId, 'to', SMTP_TO);
            } catch (err) {
                console.warn('Mail send failed:', err.message);
            }
        }

        res.json({ ok: true, id: info.lastInsertRowid });
    }
);

// Support chatbot ratings
app.post('/api/support/rate', (req, res) => {
    const { rating, comment } = req.body || {};
    const r = Number(rating);
    if (!(r >= 1 && r <= 5)) return res.status(400).json({ ok: false, error: 'invalid_rating' });
    const userId = req.user?.id || null;
    db.prepare('INSERT INTO support_ratings (user_id, rating, comment) VALUES (?, ?, ?)').run(userId, r, typeof comment === 'string' && comment.trim() ? comment.trim() : null);
    res.json({ ok: true });
});

app.get('/api/admin/support/ratings/summary', requireAuth, requireAdmin, (req, res) => {
    const row = db.prepare('SELECT COUNT(*) AS count, AVG(rating) AS avg FROM support_ratings').get();
    res.json({ ok: true, total: row.count || 0, average: row.avg ? Number(row.avg).toFixed(2) : null });
});

app.get('/api/admin/support/ratings', requireAuth, requireAdmin, (req, res) => {
    const { rating, date_from, date_to, has_comment, search } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramIndex = 1;
    
    // Rating filter
    if (rating && !isNaN(rating)) {
        whereClause += ` AND r.rating = ?`;
        params.push(parseInt(rating));
        paramIndex++;
    }
    
    // Date range filter
    if (date_from) {
        whereClause += ` AND DATE(r.created_at) >= ?`;
        params.push(date_from);
        paramIndex++;
    }
    
    if (date_to) {
        whereClause += ` AND DATE(r.created_at) <= ?`;
        params.push(date_to);
        paramIndex++;
    }
    
    // Comment filter
    if (has_comment === 'true') {
        whereClause += ` AND r.comment IS NOT NULL AND r.comment != ''`;
    } else if (has_comment === 'false') {
        whereClause += ` AND (r.comment IS NULL OR r.comment = '')`;
    }
    
    // Search filter (comment or user email)
    if (search && search.trim()) {
        whereClause += ` AND (r.comment LIKE ? OR u.email LIKE ?)`;
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm);
        paramIndex++;
    }
    
    const query = `
        SELECT r.id, r.rating, r.comment, r.created_at, u.email AS user_email
        FROM support_ratings r
        LEFT JOIN users u ON u.id = r.user_id
        ${whereClause}
        ORDER BY r.id DESC
    `;
    
    try {
        const rows = db.prepare(query).all(...params);
        res.json({ ok: true, items: rows, total: rows.length });
    } catch (error) {
        console.error('Support ratings query error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Public featured products endpoint (for main page)
app.get('/api/featured', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT * FROM featured_products 
            ORDER BY display_order ASC
        `);
        
        const featured = stmt.all();
        res.json({ ok: true, items: featured });
    } catch (error) {
        console.error('Featured products fetch error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Featured products endpoints
app.get('/api/admin/featured', requireAuth, requireAdmin, (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT * FROM featured_products 
            ORDER BY display_order ASC
        `);
        
        const featured = stmt.all();
        res.json({ ok: true, items: featured });
    } catch (error) {
        console.error('Featured products fetch error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.post('/api/admin/featured', requireAuth, requireAdmin, (req, res) => {
    try {
        const { name, platform, price, discount, badge, icon, display_order } = req.body;
        
        if (!name || !platform || !price) {
            return res.status(400).json({ ok: false, error: 'missing_info' });
        }
        
        const stmt = db.prepare(`
            INSERT INTO featured_products 
            (name, platform, price, discount, badge, icon, display_order) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(name, platform, price, discount || 0, badge || null, icon, display_order || 1);
        
        res.json({ 
            ok: true, 
            message: 'Öne çıkan ürün eklendi',
            id: result.lastInsertRowid 
        });
    } catch (error) {
        console.error('Featured product add error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.put('/api/admin/featured/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { name, platform, price, discount, badge, icon, display_order } = req.body;
        
        if (!name || !platform || !price) {
            return res.status(400).json({ ok: false, error: 'missing_info' });
        }
        
        const stmt = db.prepare(`
            UPDATE featured_products 
            SET name = ?, platform = ?, price = ?, discount = ?, badge = ?, icon = ?, display_order = ?
            WHERE id = ?
        `);
        
        stmt.run(name, platform, price, discount || 0, badge || null, icon, display_order || 1, id);
        
        res.json({ 
            ok: true, 
            message: 'Öne çıkan ürün güncellendi'
        });
    } catch (error) {
        console.error('Featured product update error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.delete('/api/admin/featured/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        const stmt = db.prepare('DELETE FROM featured_products WHERE id = ?');
        stmt.run(id);
        
        res.json({ 
            ok: true, 
            message: 'Öne çıkan ürün silindi'
        });
    } catch (error) {
        console.error('Featured product delete error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Admin: Coupon management
app.get('/api/admin/coupons', requireAuth, requireAdmin, (req, res) => {
    try {
        const coupons = db.prepare(`
            SELECT c.*, 
                   COALESCE(cu.used_count, 0) as used_count
            FROM coupons c
            LEFT JOIN (
                SELECT coupon_id, COUNT(*) as used_count
                FROM coupon_usage
                GROUP BY coupon_id
            ) cu ON c.id = cu.coupon_id
            ORDER BY c.created_at DESC
        `).all();
        
        res.json({ ok: true, items: coupons });
        
    } catch (error) {
        console.error('Coupons fetch error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.get('/api/admin/coupons/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        const coupon = db.prepare(`
            SELECT * FROM coupons WHERE id = ?
        `).get(id);
        
        if (!coupon) {
            return res.status(404).json({ ok: false, error: 'coupon_not_found' });
        }
        
        res.json({ ok: true, coupon: coupon });
        
    } catch (error) {
        console.error('Coupon fetch error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.post('/api/admin/coupons', requireAuth, requireAdmin, (req, res) => {
    try {
        const { code, type, value, min_order_amount, max_uses, valid_until, is_active } = req.body;
        
        if (!code || !type || !value) {
            return res.status(400).json({ ok: false, error: 'missing_info' });
        }
        
        const result = db.prepare(`
            INSERT INTO coupons (code, type, value, min_order_amount, max_uses, valid_until, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(code, type, value, min_order_amount || 0, max_uses || -1, valid_until || null, is_active !== false ? 1 : 0);
        
        res.json({ 
            ok: true, 
            message: 'Kupon başarıyla eklendi',
            id: result.lastInsertRowid 
        });
        
    } catch (error) {
        console.error('Coupon add error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.put('/api/admin/coupons/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { code, type, value, min_order_amount, max_uses, valid_until, is_active } = req.body;
        
        if (!code || !type || !value) {
            return res.status(400).json({ ok: false, error: 'missing_info' });
        }
        
        db.prepare(`
            UPDATE coupons 
            SET code = ?, type = ?, value = ?, min_order_amount = ?, max_uses = ?, valid_until = ?, is_active = ?
            WHERE id = ?
        `).run(code, type, value, min_order_amount || 0, max_uses || -1, valid_until || null, is_active ? 1 : 0, id);
        
        res.json({ 
            ok: true, 
            message: 'Kupon başarıyla güncellendi'
        });
        
    } catch (error) {
        console.error('Coupon update error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.delete('/api/admin/coupons/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
        
        res.json({ 
            ok: true, 
            message: 'Kupon başarıyla silindi'
        });
        
    } catch (error) {
        console.error('Coupon delete error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Admin: Product reviews management
app.get('/api/admin/reviews', requireAuth, requireAdmin, (req, res) => {
    try {
        const reviews = db.prepare(`
            SELECT r.*, p.name as product_name, u.name as user_name, u.email as user_email
            FROM product_reviews r
            JOIN products p ON p.id = r.product_id
            JOIN users u ON u.id = r.user_id
            ORDER BY r.created_at DESC
        `).all();
        
        res.json({ ok: true, items: reviews });
        
    } catch (error) {
        console.error('Reviews fetch error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.put('/api/admin/reviews/:id/approve', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { is_approved } = req.body;
        
        db.prepare(`
            UPDATE product_reviews 
            SET is_approved = ?
            WHERE id = ?
        `).run(is_approved ? 1 : 0, id);
        
        res.json({ 
            ok: true, 
            message: is_approved ? 'Yorum onaylandı' : 'Yorum onayı kaldırıldı'
        });
        
    } catch (error) {
        console.error('Review approval error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.put('/api/admin/reviews/:id/toggle-approval', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        // Get current approval status
        const review = db.prepare('SELECT is_approved FROM product_reviews WHERE id = ?').get(id);
        if (!review) {
            return res.status(404).json({ ok: false, error: 'review_not_found' });
        }
        
        // Toggle the approval status
        const newStatus = review.is_approved ? 0 : 1;
        
        db.prepare(`
            UPDATE product_reviews 
            SET is_approved = ?
            WHERE id = ?
        `).run(newStatus, id);
        
        res.json({ 
            ok: true, 
            message: newStatus ? 'Yorum onaylandı' : 'Yorum onayı kaldırıldı',
            is_approved: newStatus
        });
        
    } catch (error) {
        console.error('Review toggle approval error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

app.delete('/api/admin/reviews/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        db.prepare('DELETE FROM product_reviews WHERE id = ?').run(id);
        
        res.json({ 
            ok: true, 
            message: 'Yorum başarıyla silindi'
        });
        
    } catch (error) {
        console.error('Review delete error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Admin UI is publicly served; API enforces auth. Login form lives in this page.
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// 404 for unmatched API routes
app.use('/api', (req, res) => {
    res.status(404).json({ ok: false, error: 'Not Found' });
});

// SPA fallback to index.html for non-API routes (regex avoids path-to-regexp '*' issue)
app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({ ok: false, error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

// best-effort email sender
function sendMailSafe({ to, subject, text }) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS)) {
        if ((process.env.NODE_ENV || 'development') !== 'production') {
            console.warn('SMTP not configured, skipping email send. Intended mail:', { to, subject });
        }
        return;
    }
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        tls: { rejectUnauthorized: false }
    });
    const mailOptions = { from: SMTP_USER, to, subject, text };
    transporter.sendMail(mailOptions).catch(() => {});
}

// Dashboard statistics
app.get('/api/admin/dashboard/stats', requireAuth, requireAdmin, (req, res) => {
    try {
        // User statistics
        const userStats = db.prepare(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN email_verified = 1 THEN 1 END) as verified_users,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users
            FROM users
        `).get();
        
        // Product statistics
        const productStats = db.prepare(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(DISTINCT category) as total_categories,
                AVG(price) as avg_price
            FROM products
        `).get();
        
        // Support rating statistics
        const ratingStats = db.prepare(`
            SELECT 
                COUNT(*) as total_ratings,
                AVG(rating) as avg_rating,
                COUNT(CASE WHEN comment IS NOT NULL AND comment != '' THEN 1 END) as ratings_with_comments
            FROM support_ratings
        `).get();
        
        // Recent activity
        const recentUsers = db.prepare(`
            SELECT name, email, created_at FROM users 
            ORDER BY created_at DESC LIMIT 5
        `).all();
        
        const recentRatings = db.prepare(`
            SELECT r.rating, r.comment, r.created_at, u.email as user_email
            FROM support_ratings r
            LEFT JOIN users u ON u.id = r.user_id
            ORDER BY r.created_at DESC LIMIT 5
        `).all();
        
        res.json({
            ok: true,
            stats: {
                users: userStats,
                products: productStats,
                ratings: ratingStats
            },
            recent: {
                users: recentUsers,
                ratings: recentRatings
            }
        });
        
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ ok: false, error: 'database_error' });
    }
});
