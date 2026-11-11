// Scoped query helper.
//
// Ab security database me hai (Supabase Row Level Security), isliye client
// ko khud filter karne ki zaroorat nahi: query jayegi, aur database sirf
// wo rows lauta dega jo us user ke role/scope me aati hain.
(function () {
    function isReal(v) {
        if (v === undefined || v === null) return false;
        var s = String(v).trim();
        return s !== "" && s.toUpperCase() !== "ALL";
    }

    function isAdmin(user) {
        return !!user && ["Super Admin", "Admin"].indexOf(user.role) !== -1;
    }

    // Sirf dikhane ke liye (rules asli kaam karte hain)
    function scopeFilter(user) {
        if (!user) return null;
        if (isAdmin(user)) return null;
        if (user.role === "User") return null;
        var hub = user.hub || user.warehouse;
        if (isReal(hub)) return { field: "hub", value: String(hub).trim() };
        if (isReal(user.division)) return { field: "division", value: String(user.division).trim() };
        if (isReal(user.state)) return { field: "state", value: String(user.state).trim() };
        if (isReal(user.region)) return { field: "region", value: String(user.region).trim() };
        return null;
    }

    function query(coll, user) {
        // RLS already scope karta hai - client filter dobara lagane ki zaroorat nahi.
        return db.collection(coll);
    }

    function canRead(user) {
        return !!user && !!user.role;
    }

    function emptySnap() {
        var docs = [];
        return { docs: docs, size: 0, empty: true, forEach: function () {} };
    }

    async function get(coll, user) {
        if (!canRead(user)) return emptySnap();
        return db.collection(coll).get();
    }

    async function getShared(coll) {
        return db.collection(coll).get();
    }

    window.appScope = {
        isReal: isReal,
        isAdmin: isAdmin,
        filter: scopeFilter,
        query: query,
        get: get,
        getShared: getShared
    };
})();
