# Donation Box ERP

Donation Box Department — Inventory & Warehouse Management (static site + Supabase).

## Stack

- **Frontend:** plain HTML + CSS + vanilla JS (koi build step nahi)
- **Backend:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Hosting:** GitHub Pages (ya koi bhi static hosting)

## Kaise chalayein (local)

```powershell
node static-server.js
# ya
npx serve .
```

Phir browser me `http://127.0.0.1:5577/login.html`

> Note: `supabase-config.js` me project URL + anon key hona zaroori hai.

## Login

- Login **Employee Code + Password** se hota hai.
- Har user ke Auth account ka email:
  - User add karte waqt jo **original email** daala jaye, wahi.
  - Email na ho to `<employeecode>@donationbox.app` (internal, user ko dikhta nahi).
- Password reset: login page → **Forgot Password** me Employee Code + wahi registered
  email + naya password daalo. Dono match hone par password reset ho jata hai
  (reset ke liye ek Supabase **Edge Function** `reset-password` deploy honi chahiye —
  dekho `SUPABASE-SETUP.md`).
- Password kabhi database me save nahi hota (Supabase Auth me hashed rehta hai).

## Roles + scope

| Role | Data access |
|---|---|
| Super Admin / Admin | Sab kuch |
| Regional Manager / Regional Office | Apna region |
| State Manager / State Office | Apna state |
| Division Manager | Apni division |
| Warehouse Manager / Hub Manager / Inventory Loader | Apna hub |
| User | Koi stock/demand data nahi |

Scope **database me** lagta hai (RLS policies — `supabase/schema.sql`), browser se bypass nahi ho sakta.

## Setup (naya environment)

1. Supabase project banao
2. `supabase/schema.sql` SQL Editor me chalao
3. Auth → Email provider enable + **Confirm email OFF**
4. `supabase-config.js` me URL + anon key daalo
5. Purana data migrate karna ho to: `node supabase/scripts/migrate-from-firestore.mjs --help` jaisa usage script me likha hai

Purani Firebase files `_firebase-old/` me rakhi hain (app inhe use nahi karta).

## Files

| File | Kaam |
|---|---|
| `index.html` | Landing page |
| `login.html` | Login + forgot password |
| `reset-password.html` | Reset link se naya password set karna |
| `dashboard.html` | Dashboard + stats + filters |
| `stock-in.html` / `stock-out.html` | Stock entries, bulk, Excel |
| `demand.html` | Demand approve/dispatch/receive |
| `photos.html` | Demand photos |
| `items.html` / `hubs.html` | Master data |
| `users.html` | User management (admin) |
| `db-compat.js` | Firestore-jaisa DB adapter (Supabase par) |
| `scope-query.js` | Scoped query helper |
| `auth-guard.js` | Session guard + logout |
| `supabase-config.js` | Supabase URL + anon key |

## Dhyan

- `anon` key public hoti hai — security **RLS policies** se aati hai.
- `service_role` key kabhi repo me na daalein (sirf local scripts ke liye).
