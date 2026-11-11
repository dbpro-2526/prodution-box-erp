// Session guard for every protected page.
// 1) Blocks direct access when there is no cached session.
// 2) Verifies the real Firebase Auth session in the background and refreshes
//    the cached profile from Firestore (so a forged localStorage session can
//    never unlock data - Firestore rules check the Auth token, not localStorage).
// 3) Re-checks on pageshow so the browser Back button cannot show a page after logout.
(function () {
    var AUTH_DOMAIN = "donationbox.app";
    var redirected = false;

    function cachedSession() {
        try {
            return JSON.parse(localStorage.getItem("userSession") || "null");
        } catch (e) {
            return null;
        }
    }

    function sessionOk() {
        var s = cachedSession();
        return !!(s && s.role);
    }

    function isProtectedPage() {
        var p = (location.pathname || "").split("/").pop();
        return !(p === "" || p === "login.html" || p === "index.html");
    }

    function goLogin() {
        if (redirected) return;
        redirected = true;
        location.replace("login.html");
    }

    function guard() {
        if (!isProtectedPage()) return;
        if (sessionOk()) return;
        goLogin();
    }

    function clearSession() {
        ["userSession", "userRole", "userName", "employeeCode", "loginStatus", "appAuthMode"].forEach(function (k) {
            localStorage.removeItem(k);
        });
    }

    function profileToSession(uid, d) {
        return {
            uid: uid,
            employeeCode: d.employeeCode || "",
            fullName: d.fullName || "",
            mobile: d.mobile || "",
            email: d.email || "",
            photo: d.photo || "",
            role: d.role || "",
            department: d.department || "",
            designation: d.designation || "",
            region: d.region || "",
            state: d.state || "",
            division: d.division || "",
            hub: d.hub || d.warehouse || "",
            warehouse: d.warehouse || d.hub || "",
            status: d.status || ""
        };
    }

    function authEmailFor(code) {
        return String(code || "").trim().toLowerCase() + "@" + AUTH_DOMAIN;
    }

    var authWatchStarted = false;
    function startAuthWatch() {
        if (authWatchStarted) return;
        if (!window.firebase || typeof firebase.auth !== "function") return;
        authWatchStarted = true;
        try {
            var auth = firebase.auth();
            auth.onAuthStateChanged(async function (user) {
                if (!user) return; // Not signed in: rules already block all data.
                try {
                    var doc = await firebase.firestore().collection("users").doc(user.uid).get();
                    if (!doc.exists) {
                        // Auth account exists but profile is missing.
                        clearSession();
                        await auth.signOut();
                        goLogin();
                        return;
                    }
                    var session = profileToSession(user.uid, doc.data());
                    var old = cachedSession();
                    var changed = !old || old.uid !== session.uid || old.role !== session.role ||
                        old.region !== session.region || old.state !== session.state ||
                        old.division !== session.division || old.hub !== session.hub;
                    localStorage.setItem("userSession", JSON.stringify(session));
                    localStorage.setItem("appAuthMode", "supabase");
                    localStorage.setItem("userRole", session.role || "");
                    localStorage.setItem("userName", session.fullName || "");
                    localStorage.setItem("employeeCode", session.employeeCode || "");
                    localStorage.setItem("loginStatus", "true");
                    window.appAuthUser = session;
                    if (changed && sessionStorage.getItem("appSessionSynced") !== "1") {
                        sessionStorage.setItem("appSessionSynced", "1");
                        location.reload();
                    }
                } catch (e) {
                    // Rules/permission issue - keep the page but never clear a valid cache here.
                    console.warn("Session sync failed:", e && (e.code || e.message));
                }
            });
        } catch (e) {
            console.warn("Auth init failed:", e && e.message);
        }
    }

    window.addEventListener("pageshow", guard);
    document.addEventListener("DOMContentLoaded", function () {
        guard();
        startAuthWatch();
    });
    startAuthWatch();

    window.appLogout = function () {
        clearSession();
        try {
            sessionStorage.removeItem("appSessionSynced");
        } catch (e) {}
        var done = function () { location.replace("login.html"); };
        if (window.firebase && typeof firebase.auth === "function") {
            firebase.auth().signOut().then(done).catch(done);
        } else {
            done();
        }
    };

    window.appAuthEmailFor = authEmailFor;
})();
