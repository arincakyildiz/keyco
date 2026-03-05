# Keyco — Game Keys & Digital Products Store

**Keyco** is an e-commerce platform for selling game keys, gift cards, and digital products with instant delivery. It runs on a Node.js and Express backend and can use either SQLite or Supabase as the database.

---

## Features

- **User account**: Registration, email verification, login, OTP, password reset
- **Product catalog**: Categories (Valorant, Steam, LoL, etc.), filtering by platform and package level
- **Cart & orders**: Cart management, order creation, order tracking
- **Payments**: iyzipay integration (sandbox/production), payment verification and webhook
- **Digital code delivery**: Automatic code assignment after payment and display to the user
- **Favorites**: Save products to favorites
- **Reviews**: Product reviews and ratings
- **Coupons**: Discount coupon validation and application
- **Notifications**: User notifications and read status
- **Support**: Contact form, FAQ, support rating
- **Admin panel**: Manage products, codes, orders, users, coupons, featured items, payments, and contacts
- **API docs**: Swagger UI at `/api/docs`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express 5 |
| Database | SQLite (better-sqlite3) or Supabase (PostgreSQL) |
| Auth | JWT, bcryptjs |
| Payments | iyzipay |
| Email | Nodemailer (SMTP) |
| Security | Helmet, CORS, express-rate-limit, express-validator |
| API docs | Swagger UI (OpenAPI 3.0) |

Frontend: Static HTML/CSS/JS in `public/`, with PWA support.

---

## Requirements

- **Node.js** 18+ (or compatible LTS)
- **npm** or **yarn**

For Supabase: a [Supabase](https://supabase.com) account and project. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for details.

---

## Installation

1. **Clone the repo and install dependencies:**

```bash
git clone <repo-url>
cd keyco-main
npm install
```

2. **Configure environment variables**

Create a `.env` file in the project root. Example:

```env
# Server
PORT=5500
NODE_ENV=development

# JWT (use a strong, secret value in production)
JWT_SECRET=dev_secret_change_me

# Database: fill these if using Supabase
# SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Payments (iyzipay) — optional; runs in mock mode if not set
# IYZICO_API_KEY=
# IYZICO_SECRET=
# IYZICO_BASE_URL=https://sandbox-api.iyzipay.com

# Email (SMTP) — for verification, password reset, OTP
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=user@example.com
# SMTP_PASS=password
# SMTP_FROM=Keyco <noreply@example.com>
# SMTP_TO=support@example.com
```

- **Supabase**: If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, Supabase is used; otherwise SQLite is used.
- **iyzipay**: If API keys are not set, payments run in “mock” mode (for testing).
- **SMTP**: See [README_SMTP.txt](./README_SMTP.txt) for email configuration.

3. **Database (Supabase option)**

If using Supabase:

1. Create a project at [Supabase](https://supabase.com).
2. In the SQL Editor, run the contents of `supabase-migration.sql`.
3. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to `.env`.

Step-by-step guide: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

4. **Start the app**

```bash
npm start
```

Open in browser: `http://localhost:5500` (or the port set in `PORT`).

- **API documentation**: `http://localhost:5500/api/docs`
- **Health check**: `GET /api/health`

---

## Project Structure (overview)

```
keyco-main/
├── server.js              # Main Express app, all API routes
├── db.js                  # SQLite vs Supabase selection
├── db-supabase.js        # Supabase client and queries
├── supabase-migration.sql # Supabase schema
├── package.json
├── vercel.json           # Vercel deployment config
├── api/                  # Vercel/serverless API (if used)
├── public/               # Frontend: HTML, CSS, JS, assets
│   ├── index.html
│   ├── admin.html
│   ├── styles.css
│   └── ...
├── seed-products.js      # Sample product data
├── seed-random-packages.js
├── update-steam-rp-images.js
├── update-vp-images.js
├── SUPABASE_SETUP.md     # Supabase setup guide
├── README_SMTP.txt       # SMTP configuration
└── README.md             # This file
```

---

## Environment Variables Summary

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5500) |
| `NODE_ENV` | `development` or `production` |
| `JWT_SECRET` | JWT signing secret (keep private) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only) |
| `IYZICO_*` | iyzipay API keys and base URL |
| `SMTP_*` | Nodemailer SMTP settings |

---

## Deployment

- **Vercel**: Compatible via `vercel.json`. Set environment variables in the Vercel project settings.
- **Serverless**: `db.js` detects the environment and uses `/tmp` for SQLite when applicable; with Supabase, data is stored in Supabase.

---

## License

ISC (as specified in package.json).

---

## Related Docs

- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) — Supabase setup
- [README_SMTP.txt](./README_SMTP.txt) — SMTP / email configuration
