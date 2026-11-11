// ============================================================
//  Supabase config
//  (Settings -> API se liya gaya)
//  anon key public hoti hai - ise rakhna safe hai, kyunki asli
//  security Database ke RLS policies dete hain (dekho supabase/schema.sql).
// ============================================================
window.SUPABASE_URL = "https://fdgfeggqkcmxlwqrwxvv.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZ2ZlZ2dxa2NteGx3cXJ3eHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNzEwMTcsImV4cCI6MjEwOTk0NzAxN30.q2zK_dXcIuBQ386z9z_2SHkKyHY3vDnSP8GccvVsr6M";

// Agar user ka original email nahi diya gaya, to Employee Code se ye internal
// email ban jaati hai (user ko ye email kabhi nahi dikhta).
// NOTE: `.local` jaisi fake TLD Supabase signUp reject karta hai, isliye valid TLD.
window.SUPABASE_AUTH_DOMAIN = "donationbox.app";

// Shared client (poora app isi se baat karega)
window.sb = null;
try {
    if (/^https?:\/\//.test(String(window.SUPABASE_URL)) && String(window.SUPABASE_ANON_KEY).length > 40) {
        window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
    } else {
        console.error("Supabase config missing: supabase-config.js me SUPABASE_URL aur SUPABASE_ANON_KEY daalein.");
    }
} catch (e) {
    console.error("Supabase init failed:", e && e.message);
}
