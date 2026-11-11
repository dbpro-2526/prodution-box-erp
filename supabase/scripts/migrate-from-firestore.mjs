/*
 * Migration: Firebase Firestore  ->  Supabase (PostgreSQL)
 *
 * Kya karta hai:
 *   1. Firestore se saara data padhta hai (REST se, public rules ke dauran).
 *   2. Har user ka Supabase Auth account banata hai
 *      (email = user ka original email, ya na ho to <employeeCode>@donationbox.app,
 *       password = purana password).
 *   3. users / stock_ledger / demands / items / regions / states / divisions / hubs
 *      tables me rows daalta hai (purane document ids waise hi rakhta hai).
 *   4. Purani Firestore rows me blank `hub` ko division ke hisaab se bhar deta hai.
 *
 * Chalao (Node 18+):
 *   node supabase/scripts/migrate-from-firestore.mjs \
 *     --url https://xxxx.supabase.co \
 *     --service-key <service_role_key> \
 *     --firestore-key AIza... \
 *     --project prodution-box-erp
 *
 * Pehle dry run ke liye --dry-run laga dein (kuch nahi likhega).
 */
const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : def;
}
const DRY = args.includes("--dry-run");
const SUPA_URL = arg("--url", process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = arg("--service-key", process.env.SUPABASE_SERVICE_KEY || "");
const FS_KEY = arg("--firestore-key", process.env.FIRESTORE_API_KEY || "");
const PROJECT = arg("--project", "prodution-box-erp");
const AUTH_DOMAIN = arg("--auth-domain", "donationbox.app");

if (!SUPA_URL || !SERVICE_KEY || !FS_KEY) {
  console.error("Usage: node migrate-from-firestore.mjs --url <supabase-url> --service-key <service_role> --firestore-key <apiKey> [--project prodution-box-erp] [--dry-run]");
  process.exit(1);
}

const COLLECTIONS = ["users", "stock_ledger", "demands", "items", "regions", "states", "divisions", "hubs"];

// Sirf ye columns database me hain - baaki (purane unused fields) skip ho jayenge.
const COLS = {
  users: ["id","employeeCode","fullName","email","authEmail","mobile","photo","role","department","designation","region","state","division","hub","warehouse","status","createdAt","createdBy","updatedAt","updatedBy"],
  stock_ledger: ["id","date","itemName","quantity","unit","region","state","division","hub","recipient","empCode","purpose","source","notes","type","createdBy","role","createdAt","updatedAt","updatedBy","demandId"],
  demands: ["id","date","status","priority","requestingEntity","notes","region","state","division","hub","items","attachmentData","attachmentUrl","dispatchLog","receiveLog","approvedAt","approvedBy","rejectedAt","rejectedBy","rejectionReason","dispatchedAt","dispatchedBy","receivedAt","receivedBy","receivedByRole","createdBy","role","createdAt","updatedAt"],
  items: ["id","name","unit","createdAt","updatedAt"],
  regions: ["id","name","createdAt"],
  states: ["id","name","region","regionId","regionName","createdAt"],
  divisions: ["id","name","regionId","stateId","regionName","stateName","createdAt"],
  hubs: ["id","name","code","region","state","division","address","incharge","phone","capacity","status","createdAt"]
};
function pick(table, row) {
  const out = {};
  (COLS[table] || []).forEach((c) => { out[c] = row[c] === undefined ? null : row[c]; });
  return out;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- Firestore REST ----------------
function decodeValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  if ("referenceValue" in v) return v.referenceValue;
  return null;
}
function decodeFields(fields) {
  const out = {};
  Object.keys(fields || {}).forEach((k) => { out[k] = decodeValue(fields[k]); });
  return out;
}
function looksBlank(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

async function fetchCollection(name) {
  const rows = [];
  let token = "";
  for (;;) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${name}?pageSize=300&key=${FS_KEY}` + (token ? `&pageToken=${encodeURIComponent(token)}` : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firestore ${name} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    (body.documents || []).forEach((d) => {
      const id = d.name.split("/").pop();
      rows.push(Object.assign({ id: id }, decodeFields(d.fields)));
    });
    token = body.nextPageToken || "";
    if (!token) break;
    await wait(80);
  }
  return rows;
}

// ---------------- Supabase helpers ----------------
function sbHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json"
  };
}
async function sb(path, method, body, extraHeaders) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    method: method || "GET",
    headers: Object.assign(sbHeaders(), extraHeaders || {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) {}
  return { ok: res.ok, status: res.status, json: json, text: text };
}
async function sbTable(table, rows) {
  if (!rows.length) return;
  const clean = rows.map((r) => pick(table, r));
  for (let i = 0; i < clean.length; i += 400) {
    const chunk = clean.slice(i, i + 400);
    const res = await sb(`/rest/v1/${table}?on_conflict=id`, "POST", chunk, { Prefer: "resolution=merge-duplicates,return=minimal" });
    if (!res.ok) throw new Error(`Insert ${table} failed (${res.status}): ${res.text.slice(0, 300)}`);
    await wait(60);
  }
}
async function listAuthUsers() {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await sb(`/auth/v1/admin/users?page=${page}&per_page=1000`, "GET");
    if (!res.ok) throw new Error(`Auth list failed (${res.status}): ${res.text.slice(0, 200)}`);
    const users = (res.json && res.json.users) || [];
    out.push.apply(out, users);
    if (users.length < 1000) break;
  }
  return out;
}
async function createAuthUser(email, password, meta) {
  const res = await sb(`/auth/v1/admin/users`, "POST", {
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: meta,
    app_metadata: { role: meta.role || "", employeeCode: meta.employeeCode || "" }
  });
  if (res.ok) return res.json;
  if (res.status === 422 || /already/i.test(res.text)) return null;
  throw new Error(`Auth create failed for ${email} (${res.status}): ${res.text.slice(0, 200)}`);
}
async function updateAuthUser(uid, patch) {
  const res = await sb(`/auth/v1/admin/users/${uid}`, "PUT", patch);
  if (!res.ok) throw new Error(`Auth update failed (${res.status}): ${res.text.slice(0, 200)}`);
  return res.json;
}

function tempPassword(seed) {
  const s = String(seed || "").replace(/[^A-Za-z0-9]/g, "");
  return "Tmp@" + s.slice(-6) + "9";
}
function cleanScope(v) {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  return s.toUpperCase() === "ALL" ? "" : s;
}
function emailFor(code) {
  return String(code || "").trim().toLowerCase() + "@" + AUTH_DOMAIN;
}
function validEmail(v) {
  return /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(String(v || "").trim());
}
function authEmailFor(row) {
  const real = String(row.email || "").trim().toLowerCase();
  return validEmail(real) ? real : emailFor(row.employeeCode);
}

// ---------------- main ----------------
(async () => {
  console.log(DRY ? "MODE: DRY RUN (kuch nahi likhega)\n" : "MODE: APPLY\n");

  const data = {};
  for (const c of COLLECTIONS) {
    data[c] = await fetchCollection(c);
    console.log(`${c}: ${data[c].length} rows firestore se mile`);
  }

  // hub backfill (sirf un rows ke liye jahan hub blank hai)
  const hubByDivision = {};
  data.hubs.forEach((h) => {
    const d = String(h.division || "").trim();
    const n = String(h.name || "").trim();
    if (!d || !n) return;
    hubByDivision[d] = hubByDivision[d] || [];
    if (hubByDivision[d].indexOf(n) === -1) hubByDivision[d].push(n);
  });
  Object.keys(hubByDivision).forEach((k) => {
    if (hubByDivision[k].length !== 1) { console.warn(`WARN: division "${k}" me ${hubByDivision[k].length} hubs - backfill skip`); delete hubByDivision[k]; }
  });
  let backfilled = 0;
  ["stock_ledger", "demands"].forEach((t) => {
    data[t].forEach((r) => {
      if (!looksBlank(r.hub)) return;
      const target = hubByDivision[String(r.division || "").trim()];
      if (target) { r.hub = target[0]; backfilled++; }
    });
  });
  console.log(`\nHub backfill: ${backfilled} rows\n`);

  // users -> auth + profile
  const existing = DRY ? [] : await listAuthUsers();
  const byEmail = {};
  existing.forEach((u) => { byEmail[String(u.email || "").toLowerCase()] = u; });

  const userRows = [];
  const tempList = [];
  for (const u of data.users) {
    const code = String(u.employeeCode || "").trim();
    if (!/^[A-Za-z0-9._-]{2,32}$/.test(code)) { console.warn(`SKIP user (bad code): ${u.id} "${code}"`); continue; }
    const email = authEmailFor(u);
    let password = String(u.password || "");
    if (password.length < 6) { password = tempPassword(u.id); tempList.push(`${code} -> ${password}`); }
    let uid = byEmail[email] ? byEmail[email].id : (byEmail[emailFor(code)] ? byEmail[emailFor(code)].id : null);
    if (!uid && !DRY) {
      const created = await createAuthUser(email, password, { employeeCode: code, fullName: u.fullName || code, role: u.role || "" });
      uid = created ? created.id : (byEmail[email] && byEmail[email].id);
    }
    if (!uid && !DRY) throw new Error(`Auth user nahi bana: ${email}`);
    if (uid && !DRY) {
      await updateAuthUser(uid, { email: email, password: password, email_confirm: true, user_metadata: { employeeCode: code, fullName: u.fullName || code, role: u.role || "" } });
    }
    const row = Object.assign({}, u);
    row.authEmail = email;
    delete row.password;
    delete row.passwordUpdatedAt;
    delete row.passwordUpdatedBy;
    if (!row.fullName && u.name) row.fullName = u.name;
    row.id = uid || u.id;
    row.region = cleanScope(row.region);
    row.state = cleanScope(row.state);
    row.division = cleanScope(row.division);
    row.hub = cleanScope(row.hub);
    row.warehouse = looksBlank(row.warehouse) ? row.hub : cleanScope(row.warehouse);
    row.status = row.status || "Active";
    userRows.push(row);
    await wait(40);
  }
  console.log(`${userRows.length} users ready` + (tempList.length ? `\nTEMP PASSWORDS:\n  ${tempList.join("\n  ")}` : ""));

  if (DRY) {
    console.log("\nDry run complete. Asli migration ke liye --dry-run hata dein.");
    return;
  }

  await sbTable("users", userRows);
  await sbTable("items", data.items);
  await sbTable("regions", data.regions);
  await sbTable("states", data.states);
  await sbTable("divisions", data.divisions);
  await sbTable("hubs", data.hubs);
  await sbTable("stock_ledger", data.stock_ledger);
  await sbTable("demands", data.demands);
  console.log("\nMIGRATION DONE ✅  (users, items, regions, states, divisions, hubs, stock_ledger, demands)");
})().catch((e) => { console.error("\nFAILED:", e.message || e); process.exit(1); });
