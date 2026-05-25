# Tennis Booking System — Project Handbook

## What Is This?

A full-stack web application for managing tennis court reservations. Users register with their phone number, browse available courts, book time slots, optionally hire a coach, and pay via bank transfer. Admins confirm payments, manage courts/coaches, and view business analytics.

Built for a **Thai market** context (Thai + English language support, bank transfer payments).

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18, React Router 6, Axios    |
| Backend    | Node.js, Express 4                  |
| Database   | MongoDB via Mongoose                |
| Auth       | Phone OTP + JWT (7-day tokens)      |
| i18n       | i18next (English / Thai)            |
| File Upload| Multer (avatars, payment slips)     |
| Styling    | Plain CSS (index.css)               |

---

## Project Structure

```
Tennis_Booking/
├── backend/
│   ├── server.js              # Express entry point
│   ├── config/db.js           # MongoDB connection
│   ├── middleware/auth.js     # JWT verify + role guards
│   ├── models/                # Mongoose schemas
│   │   ├── User.js            #   phone, name, role, credit
│   │   ├── Booking.js         #   court, date, time, payment status
│   │   ├── Court.js           #   number, surface, price, hours
│   │   ├── Coach.js           #   profile, pricing, availability
│   │   ├── OTP.js             #   phone, code, expiry, attempts
│   │   └── Setting.js         #   key-value system config
│   ├── routes/                # REST API endpoints
│   │   ├── auth.js            #   register, login, OTP verify
│   │   ├── users.js           #   profile, avatar, credit, language
│   │   ├── bookings.js        #   create, pay, cancel, history
│   │   ├── courts.js          #   CRUD (admin)
│   │   ├── coaches.js         #   CRUD + schedules (admin)
│   │   ├── admin.js           #   dashboard, analytics, management
│   │   └── settings.js        #   system configuration
│   ├── utils/
│   │   ├── otp.js             # OTP generation (console.log in dev)
│   │   └── seed.js            # Database seeder
│   ├── uploads/               # Stored files (avatars, payments, coaches)
│   └── .env                   # Environment variables
│
└── frontend/
    ├── src/
    │   ├── App.js             # Routes + route guards
    │   ├── context/AuthContext.js  # Global auth state
    │   ├── utils/api.js       # Axios client + API functions
    │   ├── i18n/i18n.js       # Language config
    │   └── pages/
    │       ├── auth/          # Login, Register, OTP verification
    │       ├── user/          # Home, BookingFlow, Profile, History
    │       └── admin/         # Dashboard, court/coach/booking management
    └── .env                   # Frontend config
```

---

## How It Works (End-to-End)

### User Flow

1. **Register** — enter phone number → receive OTP (logged to console in dev) → verify
2. **Login** — phone + OTP → JWT token stored in localStorage
3. **Book a Court** — pick date → pick court → pick time slot → optionally add coach & add-ons → confirm
4. **Pay** — upload bank transfer slip image
5. **Wait** — admin reviews and confirms payment
6. **Play** — booking shows as confirmed in history

### Admin Flow

1. **Dashboard** — see today's bookings, revenue, pending payments at a glance
2. **Confirm Payments** — review uploaded slips, approve/reject
3. **Manage Courts** — create, edit, activate/deactivate courts
4. **Manage Coaches** — add coaches, set availability & pricing
5. **Analytics** — weekly/monthly/yearly revenue breakdown
6. **Settings** — configure add-ons, booking rules, payment info

---

## Data Models (Quick Reference)

| Model     | Key Fields                                                        |
|-----------|-------------------------------------------------------------------|
| **User**  | phone (unique), name, role (`user`/`admin`/`master_admin`), credit, preferredLanguage |
| **Booking** | user, court, date, startTime/endTime, coachOption, totalPrice, paymentStatus, status |
| **Court** | courtNumber, surface, pricePerHour, openTime/closeTime, isActive  |
| **Coach** | name, specialization[], pricePerHour, availability[], isInHouse   |
| **OTP**   | phone, otp, expiresAt (auto-deletes via TTL), attempts (max 5)   |
| **Setting** | key/value pairs, category (add_ons, payment, booking_rules, etc.) |

---

## Authentication & Authorization

- **Method**: Phone-based OTP → JWT
- **Token lifetime**: 7 days
- **OTP validity**: 5 minutes, max 5 attempts
- **Roles**: `user`, `admin`, `master_admin`

**Middleware chain** (in `middleware/auth.js`):
- `protect` — validates JWT, loads user, checks `isActive`
- `authorize(...roles)` — role whitelist
- `adminAccess` — shortcut for admin + master_admin
- `masterOnly` — master_admin only

**Route guards** (frontend `App.js`):
- `<PrivateRoute>` — any authenticated user
- `<UserRoute>` — regular users only
- `<AdminRoute>` — admin or master admin
- `<MasterRoute>` — master admin only
- `<PublicRoute>` — unauthenticated only (login/register)

---

## API Endpoints Overview

| Prefix           | Purpose                    | Auth Required |
|------------------|----------------------------|---------------|
| `/api/auth`      | Register, login, OTP       | No            |
| `/api/users`     | Profile, avatar, credit    | Yes           |
| `/api/bookings`  | Create, pay, cancel, list  | Yes           |
| `/api/courts`    | Court CRUD                 | Admin         |
| `/api/coaches`   | Coach CRUD + availability  | Mixed         |
| `/api/admin`     | Dashboard, analytics       | Admin         |
| `/api/settings`  | System config              | Admin         |
| `/api/health`    | Health check               | No            |

---

## File Uploads

| Type          | Path               | Max Size | Formats               |
|---------------|--------------------|---------:|-----------------------|
| User avatar   | `uploads/avatars/` | 5 MB     | JPEG, JPG, PNG, WebP  |
| Coach avatar  | `uploads/coaches/` | 5 MB     | JPEG, JPG, PNG, WebP  |
| Payment slip  | `uploads/payments/`| 10 MB    | JPEG, JPG, PNG, WebP, PDF |

Files are served statically at `/uploads/*`.

---

## Environment Variables

### Backend (`.env`)

| Variable            | Purpose                         | Default / Example                          |
|---------------------|----------------------------------|-------------------------------------------|
| `PORT`              | Server port                      | `5000`                                    |
| `MONGODB_URI`       | MongoDB connection string        | `mongodb://localhost:27017/tennis_booking` |
| `JWT_SECRET`        | Token signing secret             | **Change in production!**                 |
| `JWT_EXPIRE`        | Token lifetime                   | `7d`                                      |
| `OTP_EXPIRE_MINUTES`| OTP validity                    | `5`                                       |
| `NODE_ENV`          | Environment mode                 | `development`                             |

### Frontend (`.env`)

| Variable            | Purpose              | Default      |
|---------------------|-----------------------|-------------|
| `PORT`              | Dev server port       | `3000`      |
| `REACT_APP_API_URL` | Backend URL (optional)| `http://localhost:5000/api` |

---

## Running the Project

```bash
# 1. Start MongoDB (must be running)

# 2. Backend
cd backend
npm install
npm run seed        # (optional) seed sample data
npm run dev         # starts on :5000 with nodemon

# 3. Frontend
cd frontend
npm install
npm start           # starts on :3000, proxies API to :5000
```

The frontend proxies `/api` requests to the backend via the `proxy` field in `frontend/package.json`.

---

## Things That Are NOT Yet Implemented

These are placeholders or dev-only stubs:

- **SMS delivery** — OTPs are `console.log`'d, not actually sent (Twilio integration is commented out in `utils/otp.js`)
- **Real payment gateway** — payments are bank-transfer-only with manual admin confirmation; no Stripe/2C2P integration
- **Background jobs** — no cron jobs, no auto-expiry of bookings, no reminder notifications
- **Email notifications** — no email service connected
- **Cloud file storage** — uploads go to local disk, not S3/GCS
- **Rate limiting** — no rate limiting on auth endpoints

---

## Key Things to Know

1. **Booking IDs** follow the format `BK-XXXXXXXX` (8 random hex chars).
2. **Payment flow is manual** — user uploads a slip image, admin eyeballs it and clicks confirm.
3. **Credit system** exists — users can accumulate credit and apply it to reduce booking cost.
4. **Coach booking is optional** — users can book with no coach, an in-house coach, or bring an outside coach (just enters a name).
5. **Add-ons** are configurable via the Settings model (e.g., ball machine, racket rental).
6. **The frontend is a standard Create React App** — no Next.js, no SSR.
7. **No WebSocket/real-time** — everything is REST with polling.
8. **Database indexes** are defined in the schemas for performance (phone, booking lookups, coach queries).
9. **In production**, set `NODE_ENV=production` and the backend will serve the built frontend from `frontend/build/`.
