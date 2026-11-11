// ============================================================
//  db-compat.js
//  Purane Firebase code ko waisa hi chalne deta hai, par andar se
//  sab kuch Supabase (PostgreSQL + RLS) par jata hai.
//  Pages me `db.collection("x")...` wala code bilkul same rehta hai.
// ============================================================
(function () {
    var PAGE = 1000; // Supabase ek request me max 1000 rows deta hai

    function sb() {
        if (!window.sb) throw new Error("Supabase client load nahi hua (supabase-config.js check karein).");
        return window.sb;
    }

    function clean(obj) {
        var out = {};
        Object.keys(obj || {}).forEach(function (k) {
            var v = obj[k];
            if (v === undefined) return;
            out[k] = typeof v === "function" ? null : v;
        });
        return out;
    }

    function mapError(error) {
        var e = new Error((error && error.message) || "Database error");
        var msg = String((error && error.message) || "").toLowerCase();
        e.code = "db/error";
        if (msg.indexOf("row-level security") !== -1 || msg.indexOf("permission denied") !== -1) {
            e.code = "permission-denied";
            e.message = "Permission denied (aapke role/scope me ye data nahi hai).";
        } else if (msg.indexOf("duplicate") !== -1) {
            e.code = "already-exists";
        } else if (msg.indexOf("invalid input") !== -1 || msg.indexOf("invalid syntax") !== -1) {
            e.code = "invalid-argument";
        }
        e.original = error;
        return e;
    }

    // ---------------- document / snapshot shapes ----------------
    function makeDoc(row) {
        var data = Object.assign({}, row);
        delete data.id;
        return {
            id: row.id,
            exists: true,
            data: function () { return Object.assign({}, data); },
            get: function (k) { return data[k]; }
        };
    }

    function makeMissingDoc(id) {
        return { id: id, exists: false, data: function () { return undefined; }, get: function () { return undefined; } };
    }

    function makeSnapshot(rows) {
        var docs = (rows || []).map(makeDoc);
        return {
            docs: docs,
            size: docs.length,
            empty: docs.length === 0,
            forEach: function (fn) { docs.forEach(fn); }
        };
    }

    function newId() {
        try {
            if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        } catch (e) {}
        return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    }

    // ---------------- Query ----------------
    function Query(table, state) {
        this._table = table;
        this._state = state || { filters: [], order: null, limit: null };
    }

    Query.prototype._clone = function (patch) {
        return new Query(this._table, {
            filters: this._state.filters.slice(),
            order: this._state.order,
            limit: this._state.limit,
            range: this._state.range
        });
    };

    Query.prototype.where = function (field, op, value) {
        if (op !== "==" && op !== "===") throw new Error("Sirf '==' filter support hai (milа: " + op + ")");
        var q = this._clone();
        q._state.filters.push({ field: field, value: value });
        return q;
    };

    Query.prototype.orderBy = function (field, dir) {
        var q = this._clone();
        q._state.order = { field: field, ascending: String(dir || "asc").toLowerCase() !== "desc" };
        return q;
    };

    Query.prototype.limit = function (n) {
        var q = this._clone();
        q._state.limit = n;
        return q;
    };

    Query.prototype._build = function (from, to) {
        var sel = sb().from(this._table).select("*");
        this._state.filters.forEach(function (f) { sel = sel.eq(f.field, f.value); });
        if (this._state.order) {
            sel = sel.order(this._state.order.field, { ascending: this._state.order.ascending });
        }
        return sel.range(from, to);
    };

    Query.prototype.get = async function () {
        var all = [];
        var from = 0;
        var max = this._state.limit == null ? Infinity : this._state.limit;
        while (all.length < max) {
            var take = Math.min(PAGE, max - all.length);
            var res = await this._build(from, from + take - 1);
            if (res.error) throw mapError(res.error);
            var rows = res.data || [];
            all = all.concat(rows);
            if (rows.length < take) break;
            from += take;
        }
        return makeSnapshot(all);
    };

    // ---------------- Doc ----------------
    function Doc(table, id) {
        this._table = table;
        this.id = id || newId();
    }

    Doc.prototype.get = async function () {
        var res = await sb().from(this._table).select("*").eq("id", this.id).maybeSingle();
        if (res.error) throw mapError(res.error);
        return res.data ? makeDoc(res.data) : makeMissingDoc(this.id);
    };

    Doc.prototype.set = async function (data, opts) {
        var row = clean(data);
        row.id = this.id;
        var res = await sb().from(this._table).upsert(row, { onConflict: "id" });
        if (res.error) throw mapError(res.error);
        return { id: this.id };
    };

    Doc.prototype.update = async function (data) {
        var row = clean(data);
        delete row.id;
        var res = await sb().from(this._table).update(row).eq("id", this.id);
        if (res.error) throw mapError(res.error);
        return { id: this.id };
    };

    Doc.prototype.delete = async function () {
        var res = await sb().from(this._table).delete().eq("id", this.id);
        if (res.error) throw mapError(res.error);
        return { id: this.id };
    };

    // ---------------- Collection ----------------
    function Collection(table) {
        this._table = table;
    }

    Collection.prototype.doc = function (id) { return new Doc(this._table, id); };
    Collection.prototype.where = function (f, op, v) { return new Query(this._table).where(f, op, v); };
    Collection.prototype.orderBy = function (f, d) { return new Query(this._table).orderBy(f, d); };
    Collection.prototype.limit = function (n) { return new Query(this._table).limit(n); };
    Collection.prototype.get = function () { return new Query(this._table).get(); };

    Collection.prototype.add = async function (data) {
        var row = clean(data);
        delete row.id;
        var res = await sb().from(this._table).insert(row).select("id").single();
        if (res.error) throw mapError(res.error);
        return { id: res.data.id };
    };

    // ---------------- Batch ----------------
    function Batch() { this._ops = []; }
    Batch.prototype.set = function (ref, data) { this._ops.push({ type: "set", ref: ref, data: data }); return this; };
    Batch.prototype.update = function (ref, data) { this._ops.push({ type: "update", ref: ref, data: data }); return this; };
    Batch.prototype.delete = function (ref) { this._ops.push({ type: "delete", ref: ref }); return this; };
    Batch.prototype.commit = async function () {
        for (var i = 0; i < this._ops.length; i++) {
            var op = this._ops[i];
            if (op.type === "set") await op.ref.set(op.data);
            else if (op.type === "update") await op.ref.update(op.data);
            else await op.ref.delete();
        }
        this._ops = [];
        return true;
    };

    // ---------------- db ----------------
    var db = {
        collection: function (name) { return new Collection(name); },
        batch: function () { return new Batch(); },
        doc: function (path) {
            var parts = String(path).split("/");
            return new Doc(parts[0], parts[1]);
        }
    };

    // ---------------- auth shim (firebase.auth() jaisa) ----------------
    function mapAuthError(error) {
        var msg = String((error && error.message) || "").toLowerCase();
        var e = new Error((error && error.message) || "Auth error");
        if (msg.indexOf("invalid login") !== -1 || msg.indexOf("invalid credentials") !== -1) e.code = "auth/invalid-credential";
        else if (msg.indexOf("email not confirmed") !== -1) e.code = "auth/user-not-found";
        else if (msg.indexOf("user already registered") !== -1) e.code = "auth/email-already-in-use";
        else if (msg.indexOf("password") !== -1 && msg.indexOf("6") !== -1) e.code = "auth/weak-password";
        else if (msg.indexOf("rate limit") !== -1 || msg.indexOf("too many") !== -1) e.code = "auth/too-many-requests";
        else if (msg.indexOf("network") !== -1 || msg.indexOf("fetch") !== -1) e.code = "auth/network-request-failed";
        else e.code = (error && error.code) || "auth/unknown";
        e.original = error;
        return e;
    }

    function authUser(session) {
        if (!session || !session.user) return null;
        return { uid: session.user.id, email: session.user.email || "" };
    }

    var authApi = {
        currentUser: null,
        onAuthStateChanged: function (cb) {
            var fired = false;
            sb().auth.getSession().then(function (res) {
                fired = true;
                authApi.currentUser = authUser(res && res.data && res.data.session);
                cb(authApi.currentUser);
            }).catch(function () {
                fired = true;
                cb(null);
            });
            sb().auth.onAuthStateChange(function (_event, session) {
                var u = authUser(session);
                authApi.currentUser = u;
                if (!fired) { fired = true; cb(u); return; }
                cb(u);
            });
            return function () {};
        },
        signInWithEmailAndPassword: async function (email, password) {
            var res = await sb().auth.signInWithPassword({ email: email, password: password });
            if (res.error) throw mapAuthError(res.error);
            var u = authUser(res.data.session);
            authApi.currentUser = u;
            return { user: u };
        },
        signOut: async function () {
            authApi.currentUser = null;
            var res = await sb().auth.signOut();
            if (res && res.error) throw mapAuthError(res.error);
            return true;
        },
        sendPasswordResetEmail: async function (email) {
            var res = await sb().auth.resetPasswordForEmail(email);
            if (res.error) throw mapAuthError(res.error);
            return true;
        }
    };

    // ---------------- firebase shim ----------------
    window.firebase = {
        initializeApp: function () { return { name: "[DEFAULT]" }; },
        firestore: function () { return db; },
        auth: function () { return authApi; },
        apps: []
    };
    window.firebase.firestore.FieldValue = {
        serverTimestamp: function () { return new Date().toISOString(); },
        delete: function () { return null; },
        increment: function (n) { return n; }
    };
    window.firebase.firestore.FieldPath = {};
    window.firebase.auth.Auth = { Persistence: { LOCAL: "local" } };
})();
