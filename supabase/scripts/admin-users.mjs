/*
 * Admin helper (Supabase): user ka login account manage karo.
 * Login account banana/delete karna/password ya login-email badalna -
 * sirf service_role key se hota hai (browser se nahi).
 *
 * Chalao:
 *   node supabase/scripts/admin-users.mjs --url <supabase-url> --service-key <service_role> list
 *   node supabase/scripts/admin-users.mjs ... pass  --emp 66389 --pass NewPass@123
 *   node supabase/scripts/admin-users.mjs ... email --emp 66389 --email arkan@gmail.com
 *   node supabase/scripts/admin-users.mjs ... delete --emp 66389
 */
const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : def;
}
const SUPA_URL = arg("--url", process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = arg("--service-key", process.env.SUPABASE_SERVICE_KEY || "");
const AUTH_DOMAIN = arg("--auth-domain", "donationbox.app");
const EMP = String(arg("--emp", "")).trim();
const PASS = String(arg("--pass", ""));
const NEW_EMAIL = String(arg("--email", "")).trim().toLowerCase();
const CMD = args.find((a) => ["list", "pass", "email", "delete"].includes(a)) || "list";

if (!SUPA_URL || !SERVICE_KEY) {
  console.error("Usage: node admin-users.mjs --url <supabase-url> --service-key <service_role> [list|pass|email|delete] [--emp code] [--pass password] [--email new@mail.com]");
  process.exit(1);
}
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
const emailFor = (code) => String(code).trim().toLowerCase() + "@" + AUTH_DOMAIN;

async function profileFor(code) {
  const q = encodeURIComponent(String(code).trim());
  const res = await fetch(`${SUPA_URL}/rest/v1/users?employeeCode=eq.${q}&select=id,employeeCode,email,authEmail`, { headers });
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findUser(email) {
  for (let page = 1; ; page++) {
    const res = await fetch(`${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers });
    const body = await res.json();
    const users = (body && body.users) || [];
    const hit = users.find((u) => String(u.email || "").toLowerCase() === String(email).toLowerCase());
    if (hit) return hit;
    if (users.length < 1000) return null;
  }
}

async function authUserForProfile(profile) {
  if (!profile) return null;
  const byId = await fetch(`${SUPA_URL}/auth/v1/admin/users/${profile.id}`, { headers });
  if (byId.ok) {
    const u = await byId.json();
    if (u && u.id) return u;
  }
  const candidates = [profile.authEmail, profile.email].filter(Boolean);
  for (const email of candidates) {
    const hit = await findUser(email);
    if (hit) return hit;
  }
  return findUser(emailFor(profile.employeeCode));
}

(async () => {
  if (CMD === "list") {
    const res = await fetch(`${SUPA_URL}/auth/v1/admin/users?per_page=1000`, { headers });
    const body = await res.json();
    (body.users || []).forEach((u) => console.log(`${u.email}  (created ${u.created_at})`));
    console.log(`\nTotal: ${(body.users || []).length}`);
    return;
  }
  if (!EMP) { console.error("--emp <employeeCode> do"); process.exit(1); }

  const profile = await profileFor(EMP);
  const user = await authUserForProfile(profile);
  if (!user) {
    console.error(`Auth account nahi mila: ${EMP} (${profile ? (profile.authEmail || profile.email || emailFor(EMP)) : emailFor(EMP)})`);
    process.exit(1);
  }

  if (CMD === "pass") {
    if (PASS.length < 6) { console.error("Password kam se kam 6 characters"); process.exit(1); }
    const res = await fetch(`${SUPA_URL}/auth/v1/admin/users/${user.id}`, { method: "PUT", headers, body: JSON.stringify({ password: PASS }) });
    if (!res.ok) { console.error("FAILED:", await res.text()); process.exit(1); }
    console.log(`Password update ho gaya: ${EMP}`);
  } else if (CMD === "email") {
    if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(NEW_EMAIL)) { console.error("--email valid address do (jaise user@gmail.com)"); process.exit(1); }
    const res = await fetch(`${SUPA_URL}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ email: NEW_EMAIL, email_confirm: true })
    });
    if (!res.ok) { console.error("FAILED:", await res.text()); process.exit(1); }
    await fetch(`${SUPA_URL}/rest/v1/users?id=eq.${user.id}`, {
      method: "PATCH",
      headers: Object.assign({}, headers, { Prefer: "return=minimal" }),
      body: JSON.stringify({ authEmail: NEW_EMAIL, email: NEW_EMAIL })
    });
    console.log(`Login email update ho gaya: ${EMP} -> ${NEW_EMAIL}`);
  } else if (CMD === "delete") {
    const res = await fetch(`${SUPA_URL}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers });
    if (!res.ok) { console.error("FAILED:", await res.text()); process.exit(1); }
    await fetch(`${SUPA_URL}/rest/v1/users?id=eq.${user.id}`, { method: "DELETE", headers: Object.assign({}, headers, { Prefer: "return=minimal" }) });
    console.log(`Delete ho gaya: ${EMP}`);
  } else {
    console.error("Command samajh nahi aayi. list | pass | email | delete");
    process.exit(1);
  }
})().catch((e) => { console.error("FAILED:", e.message || e); process.exit(1); });
