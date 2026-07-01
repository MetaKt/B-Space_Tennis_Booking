# B-Space Tennis Court Booking Platform

A full-stack web application for managing tennis court reservations at a tennis club. Members book courts via a mobile-optimised interface. Staff manage bookings, payments, courts, and coaches via a desktop admin panel.

Built for the **Thai market** — Thai Baht payments, Thai + English language support, Thai phone OTP authentication via ThaiBulkSMS.

---

## Features

### Members
- Phone-number OTP login (no passwords)
- Browse courts with real-time slot availability
- Book 1–4 hour slots, optionally add an in-house or outside coach and add-ons
- Slot is **reserved immediately** when selection is confirmed — 15-minute countdown to complete payment
- Upload bank transfer slip to complete payment
- Apply credit balance to reduce payment amount
- Resume an in-progress reservation from the home screen
- View upcoming bookings and full booking history
- Cancel bookings (with refund policy)
- Thai / English language toggle

### Admins
- Dashboard: today's bookings, revenue, pending payments
- Confirm or reject payment slips
- Reassign coaches (price difference auto-calculated)
- Manage courts, coaches, and users
- Configure add-ons, booking rules, and payment details via settings
- Business analytics: revenue, court utilisation, coach earnings, top customers (master admin only)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, React Router v6, Axios, Socket.IO client, react-i18next (EN/TH), date-fns, react-hot-toast |
| **Backend** | Node.js 22, Express.js, Prisma 5.22.0, Socket.IO |
| **Database** | PostgreSQL 17 (local dev) / Supabase PostgreSQL (production) |
| **Auth** | Phone OTP → JWT access token (15 min) + refresh token (30 days, DB-stored with rotation) |
| **SMS** | ThaiBulkSMS API v2 — OTP delivery via SMS |
| **File Uploads** | Multer with MIME + extension validation (`lib/storage.js` abstraction — swap to Supabase Storage for production) |
| **Real-time** | Socket.IO — live slot availability updates across all connected users |
| **Security** | Helmet, express-rate-limit, CORS origin whitelist, OTP brute-force tracking, serializable DB transactions |

---

## Architecture

```mermaid
graph TD
    subgraph Client["User Device (Browser / Mobile)"]
        FE["React App\n(Vercel)"]
    end

    subgraph Backend["Railway — Express Server"]
        API["REST API\n/api/*"]
        WS["Socket.IO\nReal-time"]
        SEC["Helmet + CORS\n+ Rate Limiter"]
        ORM["Prisma 5.22.0"]
    end

    subgraph Storage["Supabase (Cloud)"]
        DB[(PostgreSQL\nDatabase)]
        FILES["Supabase Storage\nPayment slips"]
    end

    SMS["ThaiBulkSMS\nAPI v2"]

    FE -- "HTTPS REST" --> SEC
    FE -- "WebSocket" --> WS
    SEC --> API
    API --> ORM
    ORM --> DB
    API -- "File upload" --> FILES
    API -- "POST /sms" --> SMS
    WS -- "slot:booked\nslot:cancelled" --> FE
```

### Deployment

| Service | Provider |
|---|---|
| Frontend | Vercel (auto-deploy from GitHub) |
| Backend | Railway (auto-deploy from GitHub) |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| SMS | ThaiBulkSMS |

---

## Project Structure

```
Tennis_Booking/
├── backend/
│   ├── server.js                   # Express entry point, middleware, routes
│   ├── .env                        # Environment variables (not committed)
│   ├── config/
│   │   └── db.js                   # Prisma connection
│   ├── lib/
│   │   ├── prisma.js               # PrismaClient singleton
│   │   ├── socket.js               # Socket.IO server init + event helpers
│   │   └── storage.js              # File upload abstraction (local → Supabase swap point)
│   ├── middleware/
│   │   ├── auth.js                 # protect / authorize / adminAccess / masterOnly
│   │   └── aliasId.js              # Adds _id = id to all responses (frontend compatibility)
│   ├── routes/
│   │   ├── auth.js                 # register, login, verify-otp, resend-otp, refresh, logout, me
│   │   ├── users.js                # profile, credit, language
│   │   ├── bookings.js             # slots, coaches, create, confirm-payment, payment-slip, cancel, history
│   │   ├── courts.js               # CRUD, soft-delete
│   │   ├── coaches.js              # CRUD, availability, stats
│   │   ├── admin.js                # dashboard, booking management, user management, business summary
│   │   └── settings.js             # get, update, bulk-upsert, delete
│   ├── prisma/
│   │   ├── schema.prisma           # All models and enums
│   │   ├── seed.js                 # Seeds 3 users, 4 courts, 3 coaches, 16 settings
│   │   └── migrations/             # Version-controlled schema history
│   └── utils/
│       └── otp.js                  # OTP generation + ThaiBulkSMS delivery
│
└── frontend/
    └── src/
        ├── App.js                  # Routes and role-based guards
        ├── context/
        │   ├── AuthContext.js      # Global auth state + token refresh
        │   └── SocketContext.js    # Socket.IO connection
        ├── utils/api.js            # Axios client + all API calls
        ├── i18n/i18n.js            # EN / TH translations
        ├── components/user/
        │   ├── CourtSelector.js
        │   └── PendingPaymentModal.js
        └── pages/
            ├── auth/               # LoginPage, RegisterPage, OTPPage
            ├── user/               # HomePage, BookingFlowPage, BookingHistoryPage, ProfilePage, BookingSuccessPage
            └── admin/              # AdminDashboard, AdminBookingManagement, AdminCourtManagement,
                                    # AdminCoachManagement, AdminUserManagement, AdminSettings, AdminBusinessSummary
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 17 running locally
- A ThaiBulkSMS account (optional in dev — OTP logs to console without it)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd Tennis_Booking

cd backend && npm install
cd ../frontend && npm install
```

### 2. Set up the database

Create a PostgreSQL database named `tennis_booking`, then run migrations and seed:

```bash
cd backend
npx prisma migrate deploy
npm run seed
```

### 3. Configure environment variables

Copy the template below into `backend/.env` and fill in your values:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/tennis_booking

JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRE=15m
JWT_REFRESH_SECRET=change_this_to_another_long_random_string
JWT_REFRESH_EXPIRE=30d

OTP_EXPIRE_MINUTES=5
NODE_ENV=development
APP_NAME=B-Space Tennis Club

FRONTEND_URL=http://localhost:3000

# ThaiBulkSMS — leave blank in dev (OTP logs to console only)
THAIBULKSMS_API_KEY=
THAIBULKSMS_API_SECRET=
THAIBULKSMS_SENDER=Demo
```

### 4. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev      # runs on :5000

# Terminal 2 — frontend
cd frontend && npm start       # runs on :3000
```

Open [http://localhost:3000](http://localhost:3000)

---

## Test Accounts

These are created by `npm run seed`:

| Role | Phone | Access |
|---|---|---|
| `master_admin` | `0800000001` | Full admin panel including Business Summary |
| `admin` | `0800000002` | Full admin panel except Business Summary |
| `user` | `0891234567` | Member interface, starts with ฿500 credit |

> In development, OTP codes are printed to the backend console — no real SMS is sent.

---

## Environment Variables Reference

### Backend

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `5000`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Access token signing secret |
| `JWT_EXPIRE` | No | Access token lifetime (default: `15m`) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `JWT_REFRESH_EXPIRE` | No | Refresh token lifetime (default: `30d`) |
| `OTP_EXPIRE_MINUTES` | No | OTP validity window (default: `5`) |
| `NODE_ENV` | No | `development` or `production` |
| `APP_NAME` | No | Club name shown in OTP SMS (default: `B-Space Tennis Club`) |
| `FRONTEND_URL` | Yes (prod) | Allowed CORS origin — set to your Vercel URL in production |
| `THAIBULKSMS_API_KEY` | Yes (prod) | ThaiBulkSMS API key |
| `THAIBULKSMS_API_SECRET` | Yes (prod) | ThaiBulkSMS API secret |
| `THAIBULKSMS_SENDER` | No | Sender name shown to recipient (default: `Demo`) |

### Frontend

| Variable | Description |
|---|---|
| `REACT_APP_API_URL` | Backend API base URL (default: `http://localhost:5000/api`) |

---

## API Overview

| Prefix | Purpose | Auth |
|---|---|---|
| `POST /api/auth/register` | Register new account, send OTP | Public |
| `POST /api/auth/login` | Send OTP to existing account | Public |
| `POST /api/auth/verify-otp` | Verify OTP, receive tokens | Public |
| `POST /api/auth/refresh` | Rotate refresh token, get new access token | Public |
| `POST /api/auth/logout` | Revoke refresh token | Public |
| `GET /api/users/*` | Profile, credit | User |
| `GET /api/bookings/available-slots` | Available time slots | User |
| `POST /api/bookings` | Create provisional booking (lock slot) | User |
| `POST /api/bookings/:id/confirm-payment` | Submit coach/add-ons, debit credit | User |
| `POST /api/bookings/:id/payment-slip` | Upload bank transfer slip | User |
| `PUT /api/bookings/:id/cancel` | Cancel booking | User |
| `GET /api/courts` | List all courts | User |
| `GET /api/coaches` | List all coaches | User |
| `GET /api/admin/dashboard` | Stats + today's bookings | Admin |
| `GET /api/admin/bookings` | Full bookings list with filters | Admin |
| `PUT /api/admin/bookings/:id/confirm-payment` | Verify payment slip | Admin |
| `PUT /api/admin/bookings/:id/reassign-coach` | Change coach assignment | Admin |
| `GET /api/admin/business-summary` | Revenue analytics | Master Admin |
| `GET /api/settings/public` | Public settings (payment info, add-ons) | Public |
| `GET /api/health` | Health check | Public |

---

## Booking Flow

```
Step 1 — Select date, court, time
         ↓ click "Next →"
         POST /api/bookings → provisional created, 15-min countdown starts

Step 2 — Choose coach and add-ons

Step 3 — Upload payment slip
         ↓ click "Submit Payment"
         POST /api/bookings/:id/confirm-payment  (server re-derives all prices)
         POST /api/bookings/:id/payment-slip     (upload image)

Admin   — Reviews slip → PUT /api/admin/bookings/:id/confirm-payment
```

**Race protection:** Slot conflict check + provisional creation run inside a PostgreSQL **Serializable** transaction. Confirm-payment and cancel both use atomic conditional `updateMany` to prevent double credit debit or double refund.

---

## Deployment Guide

### 1. Supabase (Database)
1. Create a project at [supabase.com](https://supabase.com)
2. Copy the **Connection String** from Settings → Database
3. Use it as `DATABASE_URL` in Railway

### 2. Railway (Backend)
1. New Project → Deploy from GitHub → select this repo
2. Set root directory to `backend`
3. Add all environment variables (see reference above)
4. Railway gives you a URL like `https://your-app.railway.app`

### 3. Run migration on Supabase
```bash
DATABASE_URL=<supabase-url> npx prisma migrate deploy
```

### 4. Vercel (Frontend)
1. New Project → Import from GitHub → select this repo
2. Set root directory to `frontend`
3. Add environment variable: `REACT_APP_API_URL=https://your-app.railway.app/api`
4. Vercel gives you a URL like `https://your-app.vercel.app`

### 5. Update CORS
Set `FRONTEND_URL=https://your-app.vercel.app` in Railway environment variables.

---

## Important Notes

- **Prisma version is locked at 5.22.0.** Do not run `npm i prisma@latest` — Prisma 7 has breaking changes that will break this setup.
- **Never commit `.env`** — it is listed in `.gitignore`. Set environment variables through your hosting provider's dashboard.
- **ThaiBulkSMS sender name:** Use `Demo` on a trial account. Switch to an approved sender name in production.
- **File uploads** are stored on local disk in development. Migrate to Supabase Storage before deploying — only `backend/lib/storage.js` needs to change.
