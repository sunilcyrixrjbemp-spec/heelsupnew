# HeelsUp Cloudflare Backend + Frontend Integration

This repo now includes:
- Static frontend in `public/`
- Cloudflare Worker backend in `src/index.js`
- Cloudflare D1 migrations in `migrations/`
- Razorpay payment order/verify APIs
- Google Apps Script OTP email flow
- GitHub Actions deployment workflow

## 1) Local setup

```bash
npm install
cp .dev.vars.example .dev.vars
```

Update values in `.dev.vars` and `wrangler.toml`.

## 2) Create D1 DB and bind

```bash
npx wrangler d1 create heelsup-db
```

Copy returned `database_id` into `wrangler.toml` under `[[d1_databases]]`.

## 3) Run migrations

```bash
npm run db:migrate:local
# or remote
npm run db:migrate
```

## 4) Set Cloudflare secrets

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
```

Optional:
```bash
npx wrangler secret put ADMIN_BOOTSTRAP_EMAIL
npx wrangler secret put ADMIN_BOOTSTRAP_PASSWORD
```

## 5) Run locally

```bash
npm run dev
```

## 6) Deploy

```bash
npm run deploy
```

After deploy, update `public/app-config.js` API URL if required.

## 7) GitHub auto deploy

Add these repo secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Push to `main` to deploy automatically.

## 8) Make first admin user

Register one account from frontend, then run:

```bash
npx wrangler d1 execute HEELSUP_DB --command "UPDATE users SET role='admin' WHERE email='your-admin-email@example.com';"
```

## APIs added

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `GET /api/me`
- `PUT /api/me`
- `PUT /api/me/password`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/newsletter`
- `POST /api/contact`
- `POST /api/orders/cod`
- `GET /api/orders/my`
- `POST /api/payments/razorpay/order`
- `POST /api/payments/razorpay/verify`
- `GET /api/admin/orders`
- `GET/POST/PUT/DELETE /api/admin/products`

## Google Apps Script mail endpoint contract

Worker sends:
```json
{
  "token": "shared-secret",
  "to": "user@email.com",
  "subject": "HeelsUp OTP Verification Code",
  "message": "Your OTP is 123456",
  "html": "<p>...</p>",
  "app": "HeelsUp"
}
```

Your Apps Script should validate `token` and then use `MailApp.sendEmail`.
