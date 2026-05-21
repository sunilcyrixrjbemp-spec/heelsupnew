# Cloudflare Deployment Guide (Frontend + Backend)

## A) Backend (Worker + D1)
1. Cloudflare Dashboard -> Workers & Pages -> Create Worker (or use Wrangler deploy).
2. Ensure `wrangler.toml` has correct `database_id`.
3. Run:
   - `npm install`
   - `npm run db:migrate`
   - `npm run deploy`
4. Set vars in Worker settings (or via Wrangler):
   - `APP_NAME`
   - `CORS_ORIGIN` (set to your frontend domain, e.g. `https://heelsup.pages.dev`)
   - `GOOGLE_APPSCRIPT_ENDPOINT`
   - `GOOGLE_APPSCRIPT_TOKEN`
5. Set secrets:
   - `JWT_SECRET`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`

## B) Frontend (Cloudflare Pages)
1. Push this folder to GitHub.
2. Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git.
3. Choose repo and branch.
4. Build settings:
   - Framework preset: `None`
   - Build command: (leave empty)
   - Build output directory: `public`
5. Deploy.

## C) Connect frontend to backend
1. In `public/app-config.js`, set:
   - `API_BASE: "https://<your-worker-subdomain>.workers.dev"`
2. Re-deploy Pages.

## D) Razorpay
1. Add production keys in Worker secrets.
2. Payment flow uses:
   - `POST /api/payments/razorpay/order`
   - `POST /api/payments/razorpay/verify`
3. Razorpay checkout script is already added in `checkout.html`.

## E) Google Apps Script Mail OTP
1. Deploy your GAS script as Web App.
2. Copy deployment URL and set `GOOGLE_APPSCRIPT_ENDPOINT`.
3. Keep shared token same in GAS + Worker var `GOOGLE_APPSCRIPT_TOKEN`.

## F) GitHub automation
- Worker deploy: `.github/workflows/deploy.yml`
- For Pages, use Cloudflare Git integration (recommended).