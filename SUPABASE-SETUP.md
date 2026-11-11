# 🚀 Supabase Setup (Firebase se shift — step by step)

App ka code **ready hai**. Bas Supabase project banao aur 4 step karo.

---

## Step 1 — Supabase project banao

1. https://supabase.com → **Start your project** → Google se login
2. **New project**
   - Name: `donation-box-erp`
   - Database Password: strong password (kahin save kar lo)
   - Region: **Mumbai (ap-south-1)**
   - Plan: **Free**
3. 1-2 minute wait karo

---

## Step 2 — Tables + security banao

1. Left menu → **SQL Editor** → **New query**
2. File `supabase/schema.sql` ka poora content paste karo
3. **Run** dabao → "Success" aana chahiye

Ye ek hi baar karna hai. Isse tables aur **RLS security** ban jati hai
(har user sirf apna region/state/division/hub data dekhega).

---

## Step 3 — Email login enable karo

1. Left menu → **Authentication** → **Sign In / Providers**
2. **Email** provider → **Enable** (by default on hota hai)
3. **Confirm email** → **OFF** karo (zaroori hai — hum email nahi bhejte)
4. Save

> Login app me **Employee Code + Password** hi rahega.
> User add karte waqt jo **original email** daalenge, Auth email wahi banega.
> Email na ho to internal `<employeecode>@donationbox.app` banta hai.
> Forgot Password me **Employee Code + wahi email** match hone par password
> turant reset hota hai (email link ki zaroorat nahi).

### Reset-password link ke liye URL Configuration (zaroori)

**Authentication → URL Configuration**:

- **Site URL**: app ka address, jaise `http://127.0.0.1:5577`
- **Redirect URLs** me add karo:
  - `http://127.0.0.1:5577/reset-password.html`
  - host karne ke baad: `https://<your-domain>/reset-password.html`

Ye set na ho to reset mail ka link default `localhost:3000` par jayega aur
password reset nahi hoga. App me `reset-password.html` page isi ke liye hai.

### Direct Password Reset (Forgot Password button ke liye zaroori)

App me reset **email link se nahi** hota. Login page → **Forgot Password** me:
Employee Code + Registered Email + New Password + Confirm Password.
Dono match hue to password turant reset ho jata hai, warna nahi.

Iske liye ek **Edge Function** deploy karni hai (service role key server side rehti hai):

1. Supabase Dashboard → **Edge Functions** → **Deploy a new function**
2. Name: `reset-password`
3. `supabase/functions/reset-password/index.ts` ka poora code paste karo
4. **Deploy** (Verify JWT ON hi rehne do — app anon key bhejti hai)
5. Test: login page → Forgot Password → `66389` + uska auth email + naya password

> Function deploy na ho to button "Reset service deploy nahi hua" message dega.

### Custom SMTP (optional — sirf email confirmation ke liye)

Reset ab email se nahi hota, isliye SMTP **zaroori nahi** hai. Future me email
verification chahiye ho to ye settings use karo:

**Authentication → Emails → SMTP Settings → Enable Custom SMTP** me:

| Field | Resend (recommended) | Gmail |
|---|---|---|
| Host | `smtp.resend.com` | `smtp.gmail.com` |
| Port | `465` (SSL) | `465` (SSL) |
| Username | `resend` | aapka Gmail address |
| Password | Resend API key (`re_...`) | Gmail **App Password** (16 digit) |
| Sender email | verified domain ka email | aapka Gmail |
| Sender name | `Donation Box ERP` | `Donation Box ERP` |

- Resend free plan: 3,000 mail/month (domain verify karna hota hai).
- Gmail: Google Account → Security → 2-Step Verification ON → **App Passwords** se 16-digit password.
- SMTP save karne ke baad **Authentication → Rate Limits** me email limit bhi check kar lena.
- Abhi password reset email link se nahi hota, isliye ye section sirf future email
  verification ke liye hai. `reset-password.html` page bhi future ke liye rakha hai.

---

## Step 4 — Keys copy karo

**Project Settings** (⚙️) → **API**:

| Key | Kahan |
|---|---|
| Project URL | `https://xxxx.supabase.co` |
| `anon` `public` key | Project API keys |
| `service_role` key | Project API keys (secret) |

- **anon key** → `supabase-config.js` me daalni hai (public, safe)
- **service_role key** → sirf migration ke liye, kabhi code me nahi

---

## Step 5 — Config file bharo

`supabase-config.js` kholo:

```js
window.SUPABASE_URL = "https://xxxx.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOi....";   // anon public key
```

---

## Step 6 — Data migrate karo (Firebase → Supabase)

PowerShell me project folder me:

```powershell
node supabase/scripts/migrate-from-firestore.mjs `
  --url https://xxxx.supabase.co `
  --service-key <service_role_key> `
  --firestore-key <firestore-api-key> `
  --dry-run
```

Report check karo, phir `--dry-run` hata ke dobara chalao.

Ye kya karega:
- Har user ka **login account** banayega (purana password hi rakhega)
- `users` table me profile + role + scope
- 2067 stock rows + demands + master data
- Purani rows ka blank `hub` division se bhar dega

Agar kisi ka password 6 characters se chhota ho, script **TEMP PASSWORD** print karega.

---

## Step 7 — Test karo

```powershell
node "C:\Users\arkan\AppData\Local\Temp\opencode\static-server.js"
```

- `http://127.0.0.1:5577/login.html` → Employee Code `66389` + purana password
- Dashboard khulna chahiye (data same)
- Incognito me `dashboard.html` direct kholo → login par bhejna chahiye
- DevTools me fake `userSession` daalo → data **nahi** aana chahiye (RLS block karega)

---

## Step 8 — GitHub par daalo

Sirf ye **15 files** upload karo:

```
index.html   login.html   reset-password.html   dashboard.html
stock-in.html   stock-out.html   demand.html
photos.html   items.html   hubs.html
users.html

dblogo.png
supabase-config.js
db-compat.js
scope-query.js
auth-guard.js
```

GitHub Pages: Settings → Pages → Branch `main`, folder `/ (root)` → Save.

`_firebase-old/` aur `supabase/scripts/` upload karne ki zaroorat nahi.

---

## User management

| Kaam | Kaise |
|---|---|
| Naya user | `users.html` → Add User (login account + profile dono ban jayega) |
| Role/scope badalna | `users.html` → Edit |
| Password reset | `node supabase/scripts/admin-users.mjs --url ... --service-key ... pass --emp 66389 --pass NewPass@123` |
| User delete (login account + profile) | `... admin-users.mjs delete --emp 66389` |

---

## Kaise kaam karta hai (short)

```
Browser (static HTML)
   ↓  supabase-js
Supabase Auth  → login (password hashed, kabhi DB me nahi)
Supabase DB    → har table par RLS: role + scope ke hisaab se rows
                 Admin sab dekhega, baaki sirf apna hub/division/state/region
```

- `db-compat.js` purane Firebase jaisa `db.collection(...)` API deta hai,
  andar se Supabase par jaata hai. Isliye 10 pages ka code same raha.
- `scope-query.js` — ab client filter ki zaroorat nahi, database khud filter karta hai.

---

## Dhyan rakhne wali baatein

- **scope blank** (region/state/division/hub sab khali) aur role `User` nahi → us user ko **data nahi milega** (fail-closed). Aise users ko `users.html` se scope do.
- `service_role` key ko kabhi GitHub par ya code me na daalo.
- Free plan: 500 MB database (2067 rows ke liye bahut zyada hai).
- Photos abhi bhi `demands` table me base64 hain — kaam karega, lekin bahut zyada photos ho to Storage par shift karna behtar hoga.
